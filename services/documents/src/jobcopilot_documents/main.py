from jobcopilot_common import create_service_app

app = create_service_app("documents", dependencies=["postgres", "redis", "s3", "ollama"])
