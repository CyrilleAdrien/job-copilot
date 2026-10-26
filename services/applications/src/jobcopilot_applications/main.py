from jobcopilot_common import create_service_app

app = create_service_app("applications", dependencies=["postgres", "redis"])
