//! Echo provider — returns input unchanged (for development/testing).

use serde_json::Value;

use super::TranslateProvider;

pub struct Echo;

impl TranslateProvider for Echo {
    fn id(&self) -> &str {
        "echo"
    }

    fn options_schema() -> Value {
        Value::Null
    }

    fn default_options() -> Value {
        Value::Null
    }

    async fn translate(&self, text: String) -> Result<String, String> {
        Ok(text)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::Value;

    #[tokio::test]
    async fn echo_returns_input_unchanged() {
        let echo = Echo;
        assert_eq!(echo.id(), "echo");
        assert_eq!(
            echo.translate("こんにちは".to_string()).await.unwrap(),
            "こんにちは"
        );
        assert_eq!(echo.translate(String::new()).await.unwrap(), "");
        assert_eq!(echo.translate("Hello".to_string()).await.unwrap(), "Hello");
        assert!(echo.enabled());
        assert_eq!(Echo::options_schema(), Value::Null);
        assert_eq!(Echo::default_options(), Value::Null);
    }
}
