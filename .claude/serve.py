import functools, http.server, os, socketserver

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
Handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=ROOT)
with socketserver.TCPServer(("127.0.0.1", 8000), Handler) as httpd:
    httpd.serve_forever()
