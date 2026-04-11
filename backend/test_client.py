import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.test import Client

client = Client()
response = client.get('/api/subjects/')

with open('out.txt', 'w') as f:
    f.write(f'STATUS: {response.status_code}\n')
    f.write('CONTENT: ')
    try:
        f.write(response.content.decode('utf-8'))
    except Exception as e:
        f.write(str(e))
