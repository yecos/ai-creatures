use serde::{Deserialize, Serialize};
use serde_json::json;
use std::{fs, path::PathBuf, time::Duration};
use tauri::{AppHandle, Manager};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BrainConfig {
    pub mode: String,
    pub hermes_url: String,
    pub hermes_api_key: String,
    pub ollama_url: String,
    pub ollama_model: String,
    pub fallback_to_ollama: bool,
    pub allow_hermes_tools: bool,
    pub session_key: String,
}

impl Default for BrainConfig {
    fn default() -> Self {
        Self {
            mode: "local".into(),
            hermes_url: "http://127.0.0.1:8642/v1".into(),
            hermes_api_key: String::new(),
            ollama_url: "http://127.0.0.1:11434/v1".into(),
            ollama_model: "qwen3.5:latest".into(),
            fallback_to_ollama: true,
            allow_hermes_tools: false,
            session_key: "ai-creatures:miko".into(),
        }
    }
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BrainConfigInput {
    pub mode: String,
    pub hermes_url: String,
    pub hermes_api_key: Option<String>,
    pub ollama_url: String,
    pub ollama_model: String,
    pub fallback_to_ollama: bool,
    pub allow_hermes_tools: bool,
    pub session_key: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PublicBrainConfig {
    pub mode: String,
    pub hermes_url: String,
    pub hermes_key_set: bool,
    pub ollama_url: String,
    pub ollama_model: String,
    pub fallback_to_ollama: bool,
    pub allow_hermes_tools: bool,
    pub session_key: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderStatus {
    pub online: bool,
    pub label: String,
    pub detail: String,
    pub toolsets_enabled: Option<usize>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BrainStatus {
    pub active_mode: String,
    pub hermes: ProviderStatus,
    pub ollama: ProviderStatus,
    pub config: PublicBrainConfig,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BrainRequest {
    pub system_prompt: String,
    pub user_prompt: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BrainReply {
    pub provider: String,
    pub content: String,
    pub fallback_used: bool,
}

#[derive(Debug, Deserialize)]
struct ToolsetsResponse {
    data: Vec<ToolsetEntry>,
}

#[derive(Debug, Deserialize)]
struct ToolsetEntry {
    enabled: bool,
}

#[derive(Debug, Deserialize)]
struct ChatResponse {
    choices: Vec<ChatChoice>,
}

#[derive(Debug, Deserialize)]
struct ChatChoice {
    message: ChatMessage,
}

#[derive(Debug, Deserialize)]
struct ChatMessage {
    content: Option<String>,
}

fn config_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_config_dir()
        .map_err(|e| format!("No se pudo abrir la carpeta de configuración: {e}"))?;
    fs::create_dir_all(&dir)
        .map_err(|e| format!("No se pudo crear la carpeta de configuración: {e}"))?;
    Ok(dir.join("brain.json"))
}

fn load_config_inner(app: &AppHandle) -> BrainConfig {
    let Ok(path) = config_path(app) else {
        return BrainConfig::default();
    };
    let Ok(raw) = fs::read_to_string(path) else {
        return BrainConfig::default();
    };
    serde_json::from_str(&raw).unwrap_or_default()
}

fn public_config(config: &BrainConfig) -> PublicBrainConfig {
    PublicBrainConfig {
        mode: config.mode.clone(),
        hermes_url: config.hermes_url.clone(),
        hermes_key_set: !config.hermes_api_key.trim().is_empty(),
        ollama_url: config.ollama_url.clone(),
        ollama_model: config.ollama_model.clone(),
        fallback_to_ollama: config.fallback_to_ollama,
        allow_hermes_tools: config.allow_hermes_tools,
        session_key: config.session_key.clone(),
    }
}

fn clean_url(url: &str) -> String {
    url.trim().trim_end_matches('/').to_string()
}

fn v1_base(url: &str) -> String {
    let clean = clean_url(url);
    if clean.ends_with("/v1") {
        clean
    } else {
        format!("{clean}/v1")
    }
}

fn root_base(url: &str) -> String {
    let clean = clean_url(url);
    clean.strip_suffix("/v1").unwrap_or(&clean).to_string()
}

fn http_client(timeout_secs: u64) -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .timeout(Duration::from_secs(timeout_secs))
        .build()
        .map_err(|e| format!("No se pudo iniciar el cliente HTTP: {e}"))
}

async fn check_hermes(config: &BrainConfig) -> ProviderStatus {
    let Ok(client) = http_client(4) else {
        return ProviderStatus {
            online: false,
            label: "Hermes".into(),
            detail: "cliente HTTP no disponible".into(),
            toolsets_enabled: None,
        };
    };

    if config.hermes_api_key.trim().is_empty() {
        return ProviderStatus {
            online: false,
            label: "Hermes".into(),
            detail: "falta API key".into(),
            toolsets_enabled: None,
        };
    }

    let req = client
        .get(format!("{}/capabilities", v1_base(&config.hermes_url)))
        .bearer_auth(config.hermes_api_key.trim());

    match req.send().await {
        Ok(response) if response.status().is_success() => {
            match hermes_toolset_count(config).await {
                Ok(count) => ProviderStatus {
                    online: true,
                    label: "Hermes".into(),
                    detail: if count == 0 {
                        "conectado · sin herramientas".into()
                    } else {
                        format!("conectado · {count} toolsets activos")
                    },
                    toolsets_enabled: Some(count),
                },
                Err(_) => ProviderStatus {
                    online: true,
                    label: "Hermes".into(),
                    detail: "conectado · herramientas sin verificar".into(),
                    toolsets_enabled: None,
                },
            }
        }
        Ok(response) => ProviderStatus {
            online: false,
            label: "Hermes".into(),
            detail: format!("HTTP {}", response.status().as_u16()),
            toolsets_enabled: None,
        },
        Err(_) => ProviderStatus {
            online: false,
            label: "Hermes".into(),
            detail: "sin conexión".into(),
            toolsets_enabled: None,
        },
    }
}

async fn hermes_toolset_count(config: &BrainConfig) -> Result<usize, String> {
    let client = http_client(4)?;
    let response = client
        .get(format!("{}/toolsets", v1_base(&config.hermes_url)))
        .bearer_auth(config.hermes_api_key.trim())
        .send()
        .await
        .map_err(|_| "No se pudieron verificar las herramientas de Hermes".to_string())?;

    if !response.status().is_success() {
        return Err(format!("No se pudieron verificar toolsets (HTTP {})", response.status().as_u16()));
    }

    let payload: ToolsetsResponse = response
        .json()
        .await
        .map_err(|_| "Respuesta de toolsets no válida".to_string())?;
    Ok(payload.data.into_iter().filter(|item| item.enabled).count())
}

async fn ensure_hermes_safe(config: &BrainConfig) -> Result<(), String> {
    if config.allow_hermes_tools {
        return Ok(());
    }
    let count = hermes_toolset_count(config).await?;
    if count == 0 {
        Ok(())
    } else {
        Err(format!(
            "Hermes tiene {count} toolsets activos. AI Creatures los bloquea por defecto; usa un perfil Hermes sin herramientas o habilita el modo avanzado."
        ))
    }
}

async fn check_ollama(config: &BrainConfig) -> ProviderStatus {
    let Ok(client) = http_client(4) else {
        return ProviderStatus {
            online: false,
            label: "Ollama".into(),
            detail: "cliente HTTP no disponible".into(),
            toolsets_enabled: None,
        };
    };

    match client
        .get(format!("{}/models", v1_base(&config.ollama_url)))
        .send()
        .await
    {
        Ok(response) if response.status().is_success() => ProviderStatus {
            online: true,
            label: "Ollama".into(),
            detail: config.ollama_model.clone(),
            toolsets_enabled: None,
        },
        Ok(response) => ProviderStatus {
            online: false,
            label: "Ollama".into(),
            detail: format!("HTTP {}", response.status().as_u16()),
            toolsets_enabled: None,
        },
        Err(_) => ProviderStatus {
            online: false,
            label: "Ollama".into(),
            detail: "sin conexión".into(),
            toolsets_enabled: None,
        },
    }
}

async fn call_openai_compatible(
    base_url: &str,
    api_key: Option<&str>,
    model: &str,
    system_prompt: &str,
    user_prompt: &str,
    session_key: Option<&str>,
    disable_tools: bool,
) -> Result<String, String> {
    let client = http_client(45)?;
    let mut body = json!({
        "model": model,
        "messages": [
            { "role": "system", "content": system_prompt },
            { "role": "user", "content": user_prompt }
        ],
        "stream": false,
        "temperature": 0.8,
        "max_tokens": 100
    });

    if disable_tools {
        body["tool_choice"] = json!("none");
    }

    let mut req = client
        .post(format!("{}/chat/completions", v1_base(base_url)))
        .json(&body);

    if let Some(key) = api_key.filter(|value| !value.trim().is_empty()) {
        req = req.bearer_auth(key.trim());
    }
    if let Some(key) = session_key.filter(|value| !value.trim().is_empty()) {
        req = req.header("X-Hermes-Session-Key", key.trim());
    }

    let response = req
        .send()
        .await
        .map_err(|_| "No se pudo conectar con el proveedor".to_string())?;

    let status = response.status();
    if !status.is_success() {
        return Err(format!("El proveedor respondió HTTP {}", status.as_u16()));
    }

    let payload: ChatResponse = response
        .json()
        .await
        .map_err(|_| "La respuesta del proveedor no tenía el formato esperado".to_string())?;

    payload
        .choices
        .into_iter()
        .next()
        .and_then(|choice| choice.message.content)
        .map(|text| text.trim().to_string())
        .filter(|text| !text.is_empty())
        .ok_or_else(|| "El proveedor respondió sin texto".to_string())
}

#[tauri::command]
pub fn get_brain_config(app: AppHandle) -> PublicBrainConfig {
    public_config(&load_config_inner(&app))
}

#[tauri::command]
pub fn save_brain_config(app: AppHandle, input: BrainConfigInput) -> Result<PublicBrainConfig, String> {
    let mut config = load_config_inner(&app);
    config.mode = input.mode;
    config.hermes_url = clean_url(&input.hermes_url);
    config.ollama_url = clean_url(&input.ollama_url);
    config.ollama_model = input.ollama_model.trim().to_string();
    config.fallback_to_ollama = input.fallback_to_ollama;
    config.allow_hermes_tools = input.allow_hermes_tools;
    config.session_key = input.session_key.trim().to_string();

    if let Some(key) = input.hermes_api_key {
        if !key.trim().is_empty() {
            config.hermes_api_key = key.trim().to_string();
        }
    }

    if !matches!(config.mode.as_str(), "local" | "hermes" | "ollama" | "auto") {
        return Err("Modo de cerebro no válido".into());
    }
    if config.hermes_url.is_empty() || config.ollama_url.is_empty() {
        return Err("Los endpoints no pueden estar vacíos".into());
    }
    if config.ollama_model.is_empty() {
        return Err("El modelo de Ollama no puede estar vacío".into());
    }

    let path = config_path(&app)?;
    let data = serde_json::to_string_pretty(&config)
        .map_err(|e| format!("No se pudo serializar la configuración: {e}"))?;
    fs::write(path, data)
        .map_err(|e| format!("No se pudo guardar la configuración: {e}"))?;

    Ok(public_config(&config))
}

#[tauri::command]
pub async fn brain_status(app: AppHandle) -> BrainStatus {
    let config = load_config_inner(&app);
    let hermes = check_hermes(&config).await;
    let ollama = check_ollama(&config).await;

    let active_mode = match config.mode.as_str() {
        "hermes" if hermes.online => "hermes",
        "ollama" if ollama.online => "ollama",
        "auto" if hermes.online => "hermes",
        "auto" if ollama.online => "ollama",
        _ => "local",
    }
    .to_string();

    BrainStatus {
        active_mode,
        hermes,
        ollama,
        config: public_config(&config),
    }
}

#[tauri::command]
pub async fn brain_chat(app: AppHandle, request: BrainRequest) -> Result<BrainReply, String> {
    let config = load_config_inner(&app);

    let hermes_call = || async {
        ensure_hermes_safe(&config).await?;
        call_openai_compatible(
            &config.hermes_url,
            Some(&config.hermes_api_key),
            "hermes-agent",
            &request.system_prompt,
            &request.user_prompt,
            Some(&config.session_key),
            true,
        ).await
    };

    let ollama_call = || {
        call_openai_compatible(
            &config.ollama_url,
            None,
            &config.ollama_model,
            &request.system_prompt,
            &request.user_prompt,
            None,
            false,
        )
    };

    match config.mode.as_str() {
        "local" => Err("El cerebro IA está desactivado".into()),
        "ollama" => ollama_call().await.map(|content| BrainReply {
            provider: "ollama".into(),
            content,
            fallback_used: false,
        }),
        "hermes" => match hermes_call().await {
            Ok(content) => Ok(BrainReply {
                provider: "hermes".into(),
                content,
                fallback_used: false,
            }),
            Err(first_error) if config.fallback_to_ollama => {
                ollama_call().await.map(|content| BrainReply {
                    provider: "ollama".into(),
                    content,
                    fallback_used: true,
                }).map_err(|_| first_error)
            }
            Err(error) => Err(error),
        },
        "auto" => {
            if let Ok(content) = hermes_call().await {
                return Ok(BrainReply {
                    provider: "hermes".into(),
                    content,
                    fallback_used: false,
                });
            }
            if let Ok(content) = ollama_call().await {
                return Ok(BrainReply {
                    provider: "ollama".into(),
                    content,
                    fallback_used: true,
                });
            }
            Err("Hermes y Ollama no están disponibles".into())
        }
        _ => Err("Modo de cerebro no válido".into()),
    }
}
