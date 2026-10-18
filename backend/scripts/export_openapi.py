"""Write the API's OpenAPI schema to a file (default: stdout). Used to generate frontend types.

uv run python scripts/export_openapi.py ../frontend/openapi.json
"""

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.main import app  # noqa: E402

schema = json.dumps(app.openapi(), indent=2)
if len(sys.argv) > 1:
    with open(sys.argv[1], "w") as f:
        f.write(schema + "\n")
else:
    print(schema)
