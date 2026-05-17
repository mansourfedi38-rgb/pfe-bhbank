import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from monitoring.models import Region, Agency

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

# Comprehensive agency list with diverse types
new_agencies = [
    # ===== BEN AROUS (multiple agencies) =====
    {"name": "Centre d'Affaires Tunis Sud", "region": "Ben Arous", "address": "Rue du Lin Bir El Kassaa, Ben Arous", "phone": "71 386 000", "email": "ca.tunissud@bhbank.tn", "lat": "36.7430", "lng": "10.2320", "type": "CENTRE_AFFAIRES"},
    {"name": "M'HAMIDIA", "region": "Ben Arous", "address": "Avenue de l'Environnement, M'hamidia, Ben Arous", "phone": "71 387 000", "email": "ag.mhamidia@bhbank.tn", "lat": "36.7280", "lng": "10.2120", "type": "AGENCE"},
    {"name": "BOUMHAL", "region": "Ben Arous", "address": "Route de Boumhal, Ben Arous", "phone": "71 388 000", "email": "ag.boumhal@bhbank.tn", "lat": "36.7380", "lng": "10.2920", "type": "AGENCE"},
    {"name": "EZZAHRA", "region": "Ben Arous", "address": "Avenue Habib Bourguiba, Ezzahra, Ben Arous", "phone": "71 389 000", "email": "ag.ezzahra@bhbank.tn", "lat": "36.7480", "lng": "10.2520", "type": "AGENCE"},
    {"name": "MOHAMEDIA", "region": "Ben Arous", "address": "Avenue de la République, Mohamedia, Ben Arous", "phone": "71 390 000", "email": "ag.mohamedia@bhbank.tn", "lat": "36.7180", "lng": "10.2420", "type": "AGENCE"},
    {"name": "RADES", "region": "Ben Arous", "address": "Avenue Habib Bourguiba, Rades, Ben Arous", "phone": "71 391 000", "email": "ag.rades@bhbank.tn", "lat": "36.7680", "lng": "10.2720", "type": "AGENCE"},
    {"name": "Mégrine", "region": "Ben Arous", "address": "Route de Tunis, Mégrine, Ben Arous", "phone": "71 392 000", "email": "ag.megrine@bhbank.tn", "lat": "36.7780", "lng": "10.2220", "type": "AGENCE"},

    # ===== TUNIS (more agencies) =====
    {"name": "Siège BH Bank", "region": "Tunis", "address": "74 Avenue Habib Bourguiba, Tunis", "phone": "71 194 000", "email": "siege@bhbank.tn", "lat": "36.7980", "lng": "10.1810", "type": "SIEGE"},
    {"name": "BH Bank Bab El Bhar", "region": "Tunis", "address": "Place de la Victoire, Tunis", "phone": "71 125 000", "email": "ag.babelbhar@bhbank.tn", "lat": "36.7990", "lng": "10.1790", "type": "AGENCE"},
    {"name": "BH Bank Carthage", "region": "Tunis", "address": "Avenue de la Promenade, Carthage, Tunis", "phone": "71 742 000", "email": "ag.carthage@bhbank.tn", "lat": "36.8530", "lng": "10.3230", "type": "AGENCE"},
    {"name": "BH Bank La Marsa", "region": "Tunis", "address": "Avenue Habib Bourguiba, La Marsa, Tunis", "phone": "71 743 000", "email": "ag.lamarsa@bhbank.tn", "lat": "36.8780", "lng": "10.3270", "type": "AGENCE"},
    {"name": "BH Bank El Menzah", "region": "Tunis", "address": "Avenue Hedi Nouira, El Menzah, Tunis", "phone": "71 744 000", "email": "ag.elmenzah@bhbank.tn", "lat": "36.8430", "lng": "10.1670", "type": "AGENCE"},
    {"name": "BH Bank El Aouina", "region": "Tunis", "address": "Rue de l'Aéroport, El Aouina, Tunis", "phone": "71 745 000", "email": "ag.elaouina@bhbank.tn", "lat": "36.8330", "lng": "10.2070", "type": "AGENCE"},
    {"name": "Succursale Tunis Est", "region": "Tunis", "address": "Avenue Mohamed V, Tunis", "phone": "71 126 000", "email": "succ.tunisest@bhbank.tn", "lat": "36.8180", "lng": "10.1910", "type": "SUCCURSALE"},
    {"name": "GAB Lafayette", "region": "Tunis", "address": "Avenue de la Liberté, Tunis", "phone": "71 127 000", "email": "gab.lafayette@bhbank.tn", "lat": "36.8110", "lng": "10.1770", "type": "GAB"},
    {"name": "GAB Bourguiba", "region": "Tunis", "address": "36 Avenue Habib Bourguiba, Tunis", "phone": "71 128 000", "email": "gab.bourguiba@bhbank.tn", "lat": "36.8070", "lng": "10.1820", "type": "GAB"},

    # ===== ARIANA (more) =====
    {"name": "BH Bank La Soukra", "region": "Ariana", "address": "Avenue de l'Environnement, La Soukra, Ariana", "phone": "71 706 000", "email": "ag.lasoukra@bhbank.tn", "lat": "36.8720", "lng": "10.2050", "type": "AGENCE"},
    {"name": "Centre d'Affaires Ariana", "region": "Ariana", "address": "Centre Urbain Nord, Ariana", "phone": "71 707 000", "email": "ca.ariana@bhbank.tn", "lat": "36.8680", "lng": "10.1850", "type": "CENTRE_AFFAIRES"},
    {"name": "GAB Ennasr", "region": "Ariana", "address": "Avenue Hedi Nouira, Ennasr, Ariana", "phone": "71 708 000", "email": "gab.ennasr@bhbank.tn", "lat": "36.8580", "lng": "10.1650", "type": "GAB"},

    # ===== MANOUBA =====
    {"name": "BH Bank Douar Hicher", "region": "Manouba", "address": "Avenue de la République, Douar Hicher, Manouba", "phone": "71 602 000", "email": "ag.douarhicher@bhbank.tn", "lat": "36.8180", "lng": "10.0870", "type": "AGENCE"},
    {"name": "BH Bank Tebourba", "region": "Manouba", "address": "Avenue Habib Bourguiba, Tebourba, Manouba", "phone": "71 603 000", "email": "ag.tebourba@bhbank.tn", "lat": "36.8280", "lng": "10.0370", "type": "AGENCE"},
    {"name": "Succursale Manouba", "region": "Manouba", "address": "Route de Tunis, Manouba", "phone": "71 604 000", "email": "succ.manouba@bhbank.tn", "lat": "36.8090", "lng": "10.0970", "type": "SUCCURSALE"},

    # ===== NABEUL (more) =====
    {"name": "BH Bank Korba", "region": "Nabeul", "address": "Avenue Habib Bourguiba, Korba, Nabeul", "phone": "72 289 000", "email": "ag.korba@bhbank.tn", "lat": "36.4480", "lng": "10.7850", "type": "AGENCE"},
    {"name": "BH Bank Kelibia", "region": "Nabeul", "address": "Avenue de la République, Kelibia, Nabeul", "phone": "72 290 000", "email": "ag.kelibia@bhbank.tn", "lat": "36.4180", "lng": "11.0850", "type": "AGENCE"},
    {"name": "GAB Nabeul Centre", "region": "Nabeul", "address": "Avenue Habib Bourguiba, Nabeul", "phone": "72 291 000", "email": "gab.nabeul@bhbank.tn", "lat": "36.4560", "lng": "10.7350", "type": "GAB"},

    # ===== ZAGHOUAN =====
    {"name": "BH Bank El Fahs", "region": "Zaghouan", "address": "Avenue Habib Bourguiba, El Fahs, Zaghouan", "phone": "72 677 000", "email": "ag.elfahs@bhbank.tn", "lat": "36.3830", "lng": "10.1270", "type": "AGENCE"},

    # ===== BIZERTE (more) =====
    {"name": "BH Bank Mateur", "region": "Bizerte", "address": "Avenue Habib Bourguiba, Mateur, Bizerte", "phone": "72 432 000", "email": "ag.mateur@bhbank.tn", "lat": "37.2540", "lng": "9.8730", "type": "AGENCE"},
    {"name": "BH Bank Menzel Bourguiba", "region": "Bizerte", "address": "Avenue de l'Indépendance, Menzel Bourguiba, Bizerte", "phone": "72 433 000", "email": "ag.menzel@bhbank.tn", "lat": "37.2940", "lng": "9.8730", "type": "AGENCE"},
    {"name": "GAB Bizerte Centre", "region": "Bizerte", "address": "Avenue Habib Bourguiba, Bizerte", "phone": "72 434 000", "email": "gab.bizerte@bhbank.tn", "lat": "37.2740", "lng": "9.8730", "type": "GAB"},

    # ===== BÉJA (more) =====
    {"name": "BH Bank Medjez El Bab", "region": "Béja", "address": "Avenue Habib Bourguiba, Medjez El Bab, Béja", "phone": "78 451 000", "email": "ag.medjez@bhbank.tn", "lat": "36.7050", "lng": "9.1610", "type": "AGENCE"},
    {"name": "BH Bank Testour", "region": "Béja", "address": "Avenue de la République, Testour, Béja", "phone": "78 452 000", "email": "ag.testour@bhbank.tn", "lat": "36.5550", "lng": "9.4410", "type": "AGENCE"},

    # ===== JENDOUBA (more) =====
    {"name": "BH Bank Tabarka", "region": "Jendouba", "address": "Avenue Habib Bourguiba, Tabarka, Jendouba", "phone": "78 601 000", "email": "ag.tabarka@bhbank.tn", "lat": "36.9510", "lng": "8.7600", "type": "AGENCE"},
    {"name": "BH Bank Ghardimaou", "region": "Jendouba", "address": "Avenue de la République, Ghardimaou, Jendouba", "phone": "78 602 000", "email": "ag.ghardimaou@bhbank.tn", "lat": "36.4510", "lng": "8.4400", "type": "AGENCE"},

    # ===== LE KEF (more) =====
    {"name": "BH Bank Tajerouine", "region": "Le Kef", "address": "Avenue Habib Bourguiba, Tajerouine, Le Kef", "phone": "78 231 000", "email": "ag.tajerouine@bhbank.tn", "lat": "36.1340", "lng": "8.5550", "type": "AGENCE"},

    # ===== SILIANA =====
    {"name": "BH Bank Bouarada", "region": "Siliana", "address": "Avenue Habib Bourguiba, Bouarada, Siliana", "phone": "78 383 000", "email": "ag.bouarada@bhbank.tn", "lat": "36.0750", "lng": "9.3700", "type": "AGENCE"},

    # ===== KAIROUAN (more) =====
    {"name": "BH Bank Sbikha", "region": "Kairouan", "address": "Avenue Ibn Jazzar, Sbikha, Kairouan", "phone": "77 231 000", "email": "ag.sbikha@bhbank.tn", "lat": "35.6580", "lng": "10.0760", "type": "AGENCE"},
    {"name": "BH Bank El Oueslatia", "region": "Kairouan", "address": "Avenue de la République, El Oueslatia, Kairouan", "phone": "77 232 000", "email": "ag.eloueslatia@bhbank.tn", "lat": "35.8380", "lng": "9.7960", "type": "AGENCE"},
    {"name": "GAB Kairouan Centre", "region": "Kairouan", "address": "Avenue Ibn Jazzar, Kairouan", "phone": "77 233 000", "email": "gab.kairouan@bhbank.tn", "lat": "35.6780", "lng": "10.0960", "type": "GAB"},

    # ===== SOUSSE (more) =====
    {"name": "BH Bank Hammam Sousse", "region": "Sousse", "address": "Avenue Habib Bourguiba, Hammam Sousse", "phone": "73 224 000", "email": "ag.hammamsousse@bhbank.tn", "lat": "35.8550", "lng": "10.6050", "type": "AGENCE"},
    {"name": "BH Bank Khzema", "region": "Sousse", "address": "Route de Mahdia, Khzema, Sousse", "phone": "73 225 000", "email": "ag.khzema@bhbank.tn", "lat": "35.7950", "lng": "10.6350", "type": "AGENCE"},
    {"name": "Centre d'Affaires Sousse", "region": "Sousse", "address": "Avenue de la République, Sousse", "phone": "73 226 000", "email": "ca.sousse@bhbank.tn", "lat": "35.8256", "lng": "10.6410", "type": "CENTRE_AFFAIRES"},
    {"name": "Succursale Sousse", "region": "Sousse", "address": "Boulevard du Leader, Sousse", "phone": "73 227 000", "email": "succ.sousse@bhbank.tn", "lat": "35.8350", "lng": "10.6510", "type": "SUCCURSALE"},
    {"name": "GAB Sahloul", "region": "Sousse", "address": "Route de Kairouan, Sahloul", "phone": "73 228 000", "email": "gab.sahloul@bhbank.tn", "lat": "35.8150", "lng": "10.6050", "type": "GAB"},

    # ===== MONASTIR (more) =====
    {"name": "BH Bank Ksar Hellal", "region": "Monastir", "address": "Avenue Habib Bourguiba, Ksar Hellal, Monastir", "phone": "73 462 000", "email": "ag.ksarhellal@bhbank.tn", "lat": "35.7580", "lng": "10.8460", "type": "AGENCE"},
    {"name": "BH Bank Moknine", "region": "Monastir", "address": "Avenue de la République, Moknine, Monastir", "phone": "73 463 000", "email": "ag.moknine@bhbank.tn", "lat": "35.7880", "lng": "10.7960", "type": "AGENCE"},
    {"name": "GAB Monastir Centre", "region": "Monastir", "address": "Avenue Habib Bourguiba, Monastir", "phone": "73 464 000", "email": "gab.monastir@bhbank.tn", "lat": "35.7780", "lng": "10.8260", "type": "GAB"},

    # ===== MAHDIA (more) =====
    {"name": "BH Bank Chebba", "region": "Mahdia", "address": "Avenue Habib Bourguiba, Chebba, Mahdia", "phone": "73 684 000", "email": "ag.chebba@bhbank.tn", "lat": "35.4850", "lng": "11.1120", "type": "AGENCE"},
    {"name": "BH Bank Rejiche", "region": "Mahdia", "address": "Avenue de la République, Rejiche, Mahdia", "phone": "73 685 000", "email": "ag.rejiche@bhbank.tn", "lat": "35.5150", "lng": "11.0320", "type": "AGENCE"},

    # ===== SFAX (more) =====
    {"name": "BH Bank El Amra", "region": "Sfax", "address": "Route de Gabès, El Amra, Sfax", "phone": "74 299 000", "email": "ag.elamra@bhbank.tn", "lat": "34.7100", "lng": "10.7400", "type": "AGENCE"},
    {"name": "BH Bank El Hencha", "region": "Sfax", "address": "Avenue de la République, El Hencha, Sfax", "phone": "74 300 000", "email": "ag.elhencha@bhbank.tn", "lat": "34.7300", "lng": "10.7200", "type": "AGENCE"},
    {"name": "Centre d'Affaires Sfax", "region": "Sfax", "address": "Avenue Hédi Chaker, Sfax", "phone": "74 301 000", "email": "ca.sfax@bhbank.tn", "lat": "34.7400", "lng": "10.7600", "type": "CENTRE_AFFAIRES"},
    {"name": "GAB Sakiet Ezzit", "region": "Sfax", "address": "Route de Tunis, Sakiet Ezzit", "phone": "74 302 000", "email": "gab.sakietezzit@bhbank.tn", "lat": "34.8050", "lng": "10.7600", "type": "GAB"},

    # ===== GABÈS (more) =====
    {"name": "BH Bank El Hamma", "region": "Gabès", "address": "Avenue Habib Bourguiba, El Hamma, Gabès", "phone": "75 271 000", "email": "ag.elhamma@bhbank.tn", "lat": "33.8910", "lng": "9.7980", "type": "AGENCE"},
    {"name": "BH Bank Médenine", "region": "Gabès", "address": "Avenue Habib Bourguiba, Médenine", "phone": "75 272 000", "email": "ag.medenine@bhbank.tn", "lat": "33.3550", "lng": "10.5050", "type": "AGENCE"},
    {"name": "GAB Gabès Centre", "region": "Gabès", "address": "Avenue Habib Bourguiba, Gabès", "phone": "75 273 000", "email": "gab.gabes@bhbank.tn", "lat": "33.8810", "lng": "10.0980", "type": "GAB"},

    # ===== MÉDENINE =====
    {"name": "BH Bank Zarzis", "region": "Médenine", "address": "Avenue Habib Bourguiba, Zarzis, Médenine", "phone": "75 641 000", "email": "ag.zarzis@bhbank.tn", "lat": "33.5050", "lng": "11.1150", "type": "AGENCE"},
    {"name": "BH Bank Ben Guerdane", "region": "Médenine", "address": "Avenue de la République, Ben Guerdane, Médenine", "phone": "75 642 000", "email": "ag.benguerdane@bhbank.tn", "lat": "33.1450", "lng": "11.2150", "type": "AGENCE"},
    {"name": "Succursale Médenine", "region": "Médenine", "address": "Avenue Habib Bourguiba, Médenine", "phone": "75 643 000", "email": "succ.medenine@bhbank.tn", "lat": "33.3550", "lng": "10.5050", "type": "SUCCURSALE"},

    # ===== TATAOUINE =====
    {"name": "BH Bank Remada", "region": "Tataouine", "address": "Avenue Habib Bourguiba, Remada, Tataouine", "phone": "75 861 000", "email": "ag.remada@bhbank.tn", "lat": "32.9150", "lng": "10.3910", "type": "AGENCE"},

    # ===== GAFSA (more) =====
    {"name": "BH Bank Métlaoui", "region": "Gafsa", "address": "Avenue Habib Bourguiba, Métlaoui, Gafsa", "phone": "76 226 000", "email": "ag.metlaoui@bhbank.tn", "lat": "34.3050", "lng": "8.4040", "type": "AGENCE"},
    {"name": "BH Bank El Ksar", "region": "Gafsa", "address": "Avenue de la République, El Ksar, Gafsa", "phone": "76 227 000", "email": "ag.elksar@bhbank.tn", "lat": "34.4550", "lng": "8.8040", "type": "AGENCE"},

    # ===== TOZEUR =====
    {"name": "BH Bank Nefta", "region": "Tozeur", "address": "Avenue Habib Bourguiba, Nefta, Tozeur", "phone": "76 453 000", "email": "ag.nefta@bhbank.tn", "lat": "33.8690", "lng": "7.8730", "type": "AGENCE"},

    # ===== KÉBILI (more) =====
    {"name": "BH Bank Douz", "region": "Kébili", "address": "Avenue Habib Bourguiba, Douz, Kébili", "phone": "75 491 000", "email": "ag.douz@bhbank.tn", "lat": "33.4650", "lng": "9.0240", "type": "AGENCE"},
    {"name": "BH Bank Souk Lahad", "region": "Kébili", "address": "Avenue de la République, Souk Lahad, Kébili", "phone": "75 492 000", "email": "ag.souklahad@bhbank.tn", "lat": "33.9050", "lng": "8.8740", "type": "AGENCE"},
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
        print(f"Created {obj.name} ({obj.agency_type})")
    else:
        print(f"Already exists {obj.name}")

print(f"\nDone. Created {created} new agencies.")

# Print summary by type
from collections import Counter
type_counts = Counter(a.agency_type for a in Agency.objects.all())
print("\nAgency types breakdown:")
for t, c in sorted(type_counts.items()):
    print(f"  {t}: {c}")

# Print summary by region (top 10)
region_counts = Counter(a.region.name for a in Agency.objects.all())
print("\nTop regions by agency count:")
for r, c in region_counts.most_common(10):
    print(f"  {r}: {c}")
