import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from monitoring.models import Region, Agency

# Update existing agencies with realistic data
existing = [
    {
        "name": "BH bank nabeul",
        "address": "Angle Avenue Habib Bourguiba et Rue de Palestine, Nabeul",
        "phone": "72 286 000",
        "email": "ag.nabeul@bhbank.tn",
        "lat": "36.4560",
        "lng": "10.7350",
        "type": "AGENCE",
    },
    {
        "name": "bh bank mrezga",
        "address": "Rue Principale, Mrezga, Nabeul",
        "phone": "72 287 100",
        "email": "ag.mrezga@bhbank.tn",
        "lat": "36.4780",
        "lng": "10.6950",
        "type": "AGENCE",
    },
    {
        "name": "BH bank dar chaaben",
        "address": "Avenue de la République, Dar Chaabane",
        "phone": "72 288 200",
        "email": "ag.darchaaben@bhbank.tn",
        "lat": "36.4680",
        "lng": "10.7250",
        "type": "AGENCE",
    },
]

for data in existing:
    agency = Agency.objects.filter(name__iexact=data["name"]).first()
    if agency:
        agency.address = data["address"]
        agency.phone = data["phone"]
        agency.email = data["email"]
        agency.latitude = data["lat"]
        agency.longitude = data["lng"]
        agency.agency_type = data["type"]
        agency.save()
        print(f"Updated {agency.name}")

# Create regions if they don't exist
region_names = [
    "Tunis", "Ariana", "Ben Arous", "Manouba", "Nabeul", "Zaghouan",
    "Bizerte", "Béja", "Jendouba", "Le Kef", "Siliana", "Kairouan",
    "Sousse", "Monastir", "Mahdia", "Sfax", "Gabès", "Médenine",
    "Tataouine", "Gafsa", "Tozeur", "Kébili"
]
regions = {}
for rname in region_names:
    r, _ = Region.objects.get_or_create(name=rname)
    regions[rname] = r

# Add more representative agencies across Tunisia
new_agencies = [
    # Tunis
    {"name": "BH Bank Tunis Centre", "region": "Tunis", "address": "36 Avenue Habib Bourguiba, Tunis", "phone": "71 123 000", "email": "ag.tuniscentre@bhbank.tn", "lat": "36.8065", "lng": "10.1815", "type": "AGENCE"},
    {"name": "BH Bank Lafayette", "region": "Tunis", "address": "Avenue de la Liberté, Tunis", "phone": "71 124 000", "email": "ag.lafayette@bhbank.tn", "lat": "36.8100", "lng": "10.1780", "type": "AGENCE"},
    {"name": "BH Bank Le Kram", "region": "Tunis", "address": "Avenue Habib Thameur, Le Kram", "phone": "71 741 000", "email": "ag.lekram@bhbank.tn", "lat": "36.8330", "lng": "10.3170", "type": "AGENCE"},
    {"name": "Direction Régionale Nord", "region": "Tunis", "address": "Les Berges du Lac, Tunis", "phone": "71 194 000", "email": "dr.nord@bhbank.tn", "lat": "36.8320", "lng": "10.2310", "type": "DIRECTION_REGIONALE"},
    # Ariana
    {"name": "BH Bank Ariana", "region": "Ariana", "address": "Avenue de l'Environnement, Ariana", "phone": "71 705 000", "email": "ag.ariana@bhbank.tn", "lat": "36.8625", "lng": "10.1950", "type": "AGENCE"},
    # Sousse
    {"name": "BH Bank Sousse", "region": "Sousse", "address": "Avenue Habib Bourguiba, Sousse", "phone": "73 221 000", "email": "ag.sousse@bhbank.tn", "lat": "35.8256", "lng": "10.6410", "type": "AGENCE"},
    {"name": "BH Bank Sahloul", "region": "Sousse", "address": "Route de Kairouan, Sahloul", "phone": "73 222 000", "email": "ag.sahloul@bhbank.tn", "lat": "35.8150", "lng": "10.6050", "type": "AGENCE"},
    {"name": "Direction Régionale Centre", "region": "Sousse", "address": "Zone Industrielle, Sousse", "phone": "73 223 000", "email": "dr.centre@bhbank.tn", "lat": "35.8300", "lng": "10.6250", "type": "DIRECTION_REGIONALE"},
    # Monastir
    {"name": "BH Bank Monastir", "region": "Monastir", "address": "Avenue Habib Bourguiba, Monastir", "phone": "73 461 000", "email": "ag.monastir@bhbank.tn", "lat": "35.7780", "lng": "10.8260", "type": "AGENCE"},
    # Sfax
    {"name": "BH Bank Sfax", "region": "Sfax", "address": "Avenue Hédi Chaker, Sfax", "phone": "74 296 000", "email": "ag.sfax@bhbank.tn", "lat": "34.7400", "lng": "10.7600", "type": "AGENCE"},
    {"name": "BH Bank Sakiet Ezzit", "region": "Sfax", "address": "Route de Tunis, Sakiet Ezzit", "phone": "74 297 000", "email": "ag.sakietezzit@bhbank.tn", "lat": "34.8050", "lng": "10.7600", "type": "AGENCE"},
    {"name": "Direction Régionale Sud", "region": "Sfax", "address": "Route de Gabès, Sfax", "phone": "74 298 000", "email": "dr.sud@bhbank.tn", "lat": "34.7200", "lng": "10.7500", "type": "DIRECTION_REGIONALE"},
    # Gabès
    {"name": "BH Bank Gabès", "region": "Gabès", "address": "Avenue Habib Bourguiba, Gabès", "phone": "75 270 000", "email": "ag.gabes@bhbank.tn", "lat": "33.8810", "lng": "10.0980", "type": "AGENCE"},
    # Bizerte
    {"name": "BH Bank Bizerte", "region": "Bizerte", "address": "Avenue Habib Bourguiba, Bizerte", "phone": "72 431 000", "email": "ag.bizerte@bhbank.tn", "lat": "37.2740", "lng": "9.8730", "type": "AGENCE"},
    # Kairouan
    {"name": "BH Bank Kairouan", "region": "Kairouan", "address": "Avenue Ibn Jazzar, Kairouan", "phone": "77 230 000", "email": "ag.kairouan@bhbank.tn", "lat": "35.6780", "lng": "10.0960", "type": "AGENCE"},
    # Gafsa
    {"name": "BH Bank Gafsa", "region": "Gafsa", "address": "Avenue Habib Bourguiba, Gafsa", "phone": "76 225 000", "email": "ag.gafsa@bhbank.tn", "lat": "34.4250", "lng": "8.7840", "type": "AGENCE"},
    # Mahdia
    {"name": "BH Bank Mahdia", "region": "Mahdia", "address": "Avenue Habib Bourguiba, Mahdia", "phone": "73 683 000", "email": "ag.mahdia@bhbank.tn", "lat": "35.5050", "lng": "11.0620", "type": "AGENCE"},
    # Béja
    {"name": "BH Bank Béja", "region": "Béja", "address": "Avenue Habib Bourguiba, Béja", "phone": "78 450 000", "email": "ag.beja@bhbank.tn", "lat": "36.7250", "lng": "9.1810", "type": "AGENCE"},
    # Kébili
    {"name": "BH Bank Kébili", "region": "Kébili", "address": "Avenue Habib Bourguiba, Kébili", "phone": "75 490 000", "email": "ag.kebili@bhbank.tn", "lat": "33.7050", "lng": "8.9740", "type": "AGENCE"},
    # Tataouine
    {"name": "BH Bank Tataouine", "region": "Tataouine", "address": "Avenue Habib Bourguiba, Tataouine", "phone": "75 860 000", "email": "ag.tataouine@bhbank.tn", "lat": "32.9300", "lng": "10.4510", "type": "AGENCE"},
    # Tozeur
    {"name": "BH Bank Tozeur", "region": "Tozeur", "address": "Avenue Habib Bourguiba, Tozeur", "phone": "76 452 000", "email": "ag.tozeur@bhbank.tn", "lat": "33.9190", "lng": "8.1330", "type": "AGENCE"},
    # Jendouba
    {"name": "BH Bank Jendouba", "region": "Jendouba", "address": "Avenue Habib Bourguiba, Jendouba", "phone": "78 600 000", "email": "ag.jendouba@bhbank.tn", "lat": "36.5010", "lng": "8.7800", "type": "AGENCE"},
    # Le Kef
    {"name": "BH Bank Le Kef", "region": "Le Kef", "address": "Avenue Habib Bourguiba, Le Kef", "phone": "78 230 000", "email": "ag.lekef@bhbank.tn", "lat": "36.1740", "lng": "8.7050", "type": "AGENCE"},
    # Siliana
    {"name": "BH Bank Siliana", "region": "Siliana", "address": "Avenue Habib Bourguiba, Siliana", "phone": "78 382 000", "email": "ag.siliana@bhbank.tn", "lat": "36.0850", "lng": "9.3700", "type": "AGENCE"},
    # Zaghouan
    {"name": "BH Bank Zaghouan", "region": "Zaghouan", "address": "Avenue Habib Bourguiba, Zaghouan", "phone": "72 676 000", "email": "ag.zaghouan@bhbank.tn", "lat": "36.4030", "lng": "10.1470", "type": "AGENCE"},
    # Ben Arous
    {"name": "BH Bank Ben Arous", "region": "Ben Arous", "address": "Avenue Habib Bourguiba, Ben Arous", "phone": "71 385 000", "email": "ag.benarous@bhbank.tn", "lat": "36.7530", "lng": "10.2180", "type": "AGENCE"},
    # Manouba
    {"name": "BH Bank Manouba", "region": "Manouba", "address": "Avenue de la République, Manouba", "phone": "71 601 000", "email": "ag.manouba@bhbank.tn", "lat": "36.8080", "lng": "10.0970", "type": "AGENCE"},
    # Médenine
    {"name": "BH Bank Médenine", "region": "Médenine", "address": "Avenue Habib Bourguiba, Médenine", "phone": "75 640 000", "email": "ag.medenine@bhbank.tn", "lat": "33.3550", "lng": "10.5050", "type": "AGENCE"},
    # Nabeul (more)
    {"name": "BH Bank Hammamet", "region": "Nabeul", "address": "Avenue de la République, Hammamet", "phone": "72 280 000", "email": "ag.hammamet@bhbank.tn", "lat": "36.4000", "lng": "10.6200", "type": "AGENCE"},
]

created = 0
for data in new_agencies:
    region = regions.get(data["region"])
    if not region:
        continue
    obj, was_created = Agency.objects.get_or_create(
        name=data["name"],
        region=region,
        defaults={
            "address": data["address"],
            "phone": data["phone"],
            "email": data["email"],
            "latitude": data["lat"],
            "longitude": data["lng"],
            "agency_type": data["type"],
        },
    )
    if was_created:
        created += 1
        print(f"Created {obj.name}")
    else:
        print(f"Already exists {obj.name}")

print(f"\nDone. Created {created} new agencies.")
