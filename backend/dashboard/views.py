from django.shortcuts import render

# Create your views here.
from django.http import JsonResponse

def dashboard_data(request):
    data = {
        "temperature": 24,
        "humidity": 55,
        "number_of_clients": 18,
        "agency": "BH Bank - Nabeul Branch"
    }
    return JsonResponse(data)