import urllib.request
import urllib.error

url = 'http://127.0.0.1:8000/api/subjects/'
req = urllib.request.Request(url, headers={'Accept': 'text/html'})
try:
    response = urllib.request.urlopen(req)
    print("STATUS:", response.getcode())
except urllib.error.HTTPError as e:
    print("ERROR STATUS:", e.code)
    try:
        print("ERROR CONTENT:", e.read().decode('utf-8'))
    except Exception:
        pass
except Exception as e:
    print("FATAL:", str(e))
