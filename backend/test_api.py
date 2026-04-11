import urllib.request
import urllib.error

url = 'http://127.0.0.1:8000/api/subjects/'
try:
    response = urllib.request.urlopen(url)
    print("STATUS:", response.getcode())
    print("CONTENT:", response.read().decode('utf-8'))
except urllib.error.HTTPError as e:
    print("ERROR STATUS:", e.code)
    print("ERROR CONTENT:", e.read().decode('utf-8'))
except Exception as e:
    print("FATAL:", str(e))
