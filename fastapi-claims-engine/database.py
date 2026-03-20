def get_db(app):
    """Utility to extract mongo connection from app scope"""
    return app.mongodb
