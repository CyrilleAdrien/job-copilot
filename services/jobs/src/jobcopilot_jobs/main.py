from jobcopilot_common import create_service_app

app = create_service_app("jobs", dependencies=["postgres", "redis"])
