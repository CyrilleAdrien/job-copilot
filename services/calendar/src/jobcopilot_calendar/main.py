from jobcopilot_common import create_service_app

app = create_service_app("calendar", dependencies=["postgres", "redis"])
