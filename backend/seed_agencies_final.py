import os, django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()
from monitoring.models import Region, Agency

region_names = [
    "Ariana","Béja","Ben Arous","Bizerte","Gabès","Gafsa","Jardins de Carthage",
    "Jendouba","Jerba","Kairouan","Kasserine","Kébili","Le Kef","Mahdia",
    "Manouba","Médenine","Monastir","Nabeul","Sfax","Sidi Bouzid",
    "Siliana","Sousse","Tataouine","Tozeur","Tunis","Zaghouan","cap bon"
]
regions = {}
for rname in region_names:
    r, _ = Region.objects.get_or_create(name=rname)
    regions[rname] = r

# Comprehensive agency list from official BH Bank site + additional coverage
# Format: (name, region, address, phone, email, lat, lng, type)
AGENCIES = [
    # ===== DIRECTIONS REGIONALES =====
    ("DIRECTION REGIONALE NORD","Bizerte","Angle Rue d'Alger et Espagne, Bizerte Nord 7000","71127315","d.bizerteibnkhaldoun@bhbank.tn","37.2740","9.8730","DIRECTION_REGIONALE"),
    ("DIRECTION REGIONALE GAFSA","Gafsa","27 Av Taieb Mehiri, Gafsa 2100","71127319","d.gafsa@bhbank.tn","34.4250","8.7840","DIRECTION_REGIONALE"),
    ("DIRECTION REGIONALE GABES","Gabès","174 Av Farhat Hached, Gabes 6000","71127260","d.gabes@bhbank.tn","33.8810","10.0980","DIRECTION_REGIONALE"),
    ("DIRECTION REGIONALE SFAX","Sfax","Rue Commandant Bejaoui 3000, Sfax Ville","71127215","d.sfax@bhbank.tn","34.7400","10.7600","DIRECTION_REGIONALE"),
    ("DIRECTION REGIONALE SAHEL","Sousse","Resid ElHana Av Mongi Slim, Medina Sousse 4000","71127288","d.sousse@bhbank.tn","35.8256","10.6410","DIRECTION_REGIONALE"),
    ("DIRECTION REGIONALE TUNIS NORD","Tunis","05 Residence Essaad, rue Lac Leman, Les Berges du Lac 1035","71127322","d.tunis-nord@bhbank.tn","36.8320","10.2360","DIRECTION_REGIONALE"),
    ("DIRECTION REGIONALE TUNIS VILLE","Tunis","05 Residence Essaad, rue Lac Leman, Les Berges du Lac 1035","71127322","d.tunis-medina@bhbank.tn","36.8330","10.2370","DIRECTION_REGIONALE"),
    ("DIRECTION REGIONALE TUNIS SUD","Ben Arous","Rue du Lin Bir El Kassaa","71126086","d.tunis-sud@bhbank.tn","36.7430","10.2320","DIRECTION_REGIONALE"),
    ("DIRECTION REGIONALE NABEUL","Nabeul","30 Avenue Habib Bourguiba, Nabeul 8000","71127277","d.nabeul@bhbank.tn","36.4560","10.7350","DIRECTION_REGIONALE"),
    ("DIRECTION REGIONALE JENDOUBA","Jendouba","61 Avenue Hedi Chaker, Jendouba 8100","71127360","d.jendouba@bhbank.tn","36.5010","8.7810","DIRECTION_REGIONALE"),
    ("DIRECTION REGIONALE KAIROUAN","Kairouan","Avenue Ibn Jazzar, Kairouan","71127270","d.kairouan@bhbank.tn","36.8080","10.0820","DIRECTION_REGIONALE"),

    # ===== CENTRES D'AFFAIRES =====
    ("Centre d'Affaires Gabes","Gabès","Rue Mongi Slim, immeuble Oumaima Centre 1er étage Bloc B, Gabes 6000","71127483","ezzeddine.ouerimi@bhbank.tn","33.8810","10.0980","CENTRE_AFFAIRES"),
    ("Centre d'Affaires Sousse","Sousse","26 Résidence El Hana Avenue Mongi Slim, Sousse Medina 4000","71127485","mohamedanouar.benhassine@bhbank.tn","35.8200","10.6350","CENTRE_AFFAIRES"),
    ("Centre d'Affaires Sfax","Sfax","Avenue de l'environnement, route de Gabes, Sfax","71127488","ahmed.mhiri@bhbank.tn","34.7400","10.7600","CENTRE_AFFAIRES"),
    ("Centre d'Affaires Bizerte","Bizerte","Angle rue d'Espagne et Avenue Farhat Hached","31261007","thouraya.kamoun@bhbank.tn","37.2740","9.8730","CENTRE_AFFAIRES"),
    ("Centre d'Affaires Tunis Sud","Ben Arous","Rue du Lin Bir El Kassaa","71126086","mohamed.selimbouazizi@bhbank.tn","36.7430","10.2320","CENTRE_AFFAIRES"),
    ("Centre d'Affaires Ariana","Ariana","Centre Urbain Nord, Ariana","71707000","ca.ariana@bhbank.tn","36.8680","10.1850","CENTRE_AFFAIRES"),
    ("Centre d'Affaires Kairouan","Kairouan","Avenue Ibn Jazzar, Kairouan","77233000","ca.kairouan@bhbank.tn","36.8080","10.0820","CENTRE_AFFAIRES"),

    # ===== SIEGE =====
    ("Siège BH Bank","Tunis","74 Avenue Habib Bourguiba, Tunis","71194000","siege@bhbank.tn","36.7980","10.1810","SIEGE"),

    # ===== SUCCURSALES =====
    ("Succursale Tunis Est","Tunis","Avenue Mohamed V, Tunis","71126000","succ.tunisest@bhbank.tn","36.8180","10.1910","SUCCURSALE"),
    ("Succursale Sousse","Sousse","Boulevard du Leader, Sousse","73227000","succ.sousse@bhbank.tn","35.8350","10.6510","SUCCURSALE"),
    ("Succursale Manouba","Manouba","Route de Tunis, Manouba","71604000","succ.manouba@bhbank.tn","36.8090","10.0970","SUCCURSALE"),
    ("Succursale Médenine","Médenine","Avenue Habib Bourguiba, Médenine","75643000","succ.medenine@bhbank.tn","33.3550","10.5050","SUCCURSALE"),
    ("Succursale Monastir","Monastir","Avenue Taieb M'hiri, Monastir","73266000","succ.monastir@bhbank.tn","35.7780","10.8260","SUCCURSALE"),
    ("Succursale Sfax","Sfax","Avenue Hédi Chaker, Sfax","74299000","succ.sfax@bhbank.tn","34.7400","10.7600","SUCCURSALE"),

    # ===== GAB / SPECIAL LOCATIONS =====
    ("GAB NIDA Center","Ariana","NIDA CENTER, Ariana","71706000","gab.nida@bhbank.tn","36.8620","10.1920","GAB"),
    ("GAB Hôpital Sahloul","Sousse","HOPITAL SAHLOUL, Sousse","73224000","gab.sahloul@bhbank.tn","35.8100","10.6000","GAB"),
    ("GAB Pole Technologique Ghazala","Ariana","POLE GHAZALA, Ariana","71708000","gab.ghazala@bhbank.tn","36.8780","10.1950","GAB"),
    ("GAB MAC SA Lac I","Tunis","MAC SA LAC I, Tunis Lac 1","71125000","gab.macsa@bhbank.tn","36.8320","10.2360","GAB"),
    ("GAB Hôtel Marriott","Tunis","HOTEL MARRIOT, Centre Urbain Nord, Tunis","71127000","gab.marriott@bhbank.tn","36.8430","10.1670","GAB"),
    ("GAB Hôtel Shems","Monastir","HOTEL SHEMS, Monastir","73266000","gab.shems@bhbank.tn","35.7750","10.8200","GAB"),
    ("GAB Kantaoui Bey","Sousse","KANTAOUI BEY, Sousse","73226000","gab.kantaoui@bhbank.tn","35.9020","10.5950","GAB"),
    ("GAB Clinique Taoufik","Tunis","CLINIQUE TAOUFIK, Tunis","71128000","gab.taoufik@bhbank.tn","36.8330","10.2070","GAB"),
    ("GAB Ras Jbel Wash","Bizerte","RAS JBEL WASH, Bizerte","72432000","gab.rasjbel@bhbank.tn","37.2330","9.9430","GAB"),
    ("GAB Aéroport Jerba","Médenine","AEROPORT JERBA, Medenine","75364000","gab.aeroportjerba@bhbank.tn","33.8750","10.7750","GAB"),
    ("GAB Beni Khaled","Nabeul","BENI KHALLED, Nabeul","72289000","gab.benikhaled@bhbank.tn","36.4960","10.7650","GAB"),
    ("GAB Ecole Militaire","Bizerte","ECOLE MILITAIRE, Bizerte","72433000","gab.ecolemilitaire@bhbank.tn","37.2740","9.8730","GAB"),
    ("GAB Jerba Midoun Borgo","Médenine","JERBA MIDOUN BORGO, Djerba","75364000","gab.jerbaborigo@bhbank.tn","33.8680","10.7730","GAB"),
    ("GAB Sartex Siège","Monastir","SARTEX, Monastir","73266000","gab.sartex@bhbank.tn","35.7800","10.8300","GAB"),
    ("GAB Hôtel Mövenpick","Tunis","HOTEL MOVINPICK, Tunis","71129000","gab.movenpick@bhbank.tn","36.8500","10.3200","GAB"),
    ("GAB Aéroport Carthage 2","Tunis","AEROPORT CARTHAGE 2, Tunis","71130000","gab.carthage2@bhbank.tn","36.8510","10.2270","GAB"),
    ("GAB Z Tour","Médenine","Z TOUR, Jerba Midoun","75364000","gab.ztour@bhbank.tn","33.8150","10.9900","GAB"),
    ("GAB Hôtel Tour Khalef","Sousse","HOTEL TOUR KHALEF, Sousse","73227000","gab.tourkhalef@bhbank.tn","35.9000","10.5900","GAB"),
    ("GAB Billionaire","Tunis","BILLIONAIRE, Gamarth","71131000","gab.billionaire@bhbank.tn","36.8950","10.3350","GAB"),
    ("GAB La Gare Barcelone","Tunis","LA GARE, Tunis","71132000","gab.gare@bhbank.tn","36.7990","10.1790","GAB"),
    ("GAB Epidor Siège","Sousse","EPIDOR, Sousse","73228000","gab.epidor@bhbank.tn","35.8250","10.6400","GAB"),
    ("GAB Aéroport Carthage","Tunis","AEROPORT CARTHAGE, Tunis","71133000","gab.carthage@bhbank.tn","36.8500","10.2270","GAB"),
    ("GAB Hôtel Diar Andalus","Sousse","HOTEL DIAR ANDALUS, Sousse","73229000","gab.diarandalus@bhbank.tn","35.9050","10.6000","GAB"),
    ("GAB Lafayette","Tunis","Avenue de la Liberté, Tunis","71127000","gab.lafayette@bhbank.tn","36.8110","10.1770","GAB"),
    ("GAB Bourguiba","Tunis","36 Avenue Habib Bourguiba, Tunis","71128000","gab.bourguiba@bhbank.tn","36.8070","10.1820","GAB"),
    ("GAB Ennasr","Ariana","Avenue Hedi Nouira, Ennasr, Ariana","71708000","gab.ennasr@bhbank.tn","36.8580","10.1650","GAB"),
    ("GAB Nabeul Centre","Nabeul","Avenue Habib Bourguiba, Nabeul","72291000","gab.nabeul@bhbank.tn","36.4560","10.7350","GAB"),
    ("GAB Bizerte Centre","Bizerte","Avenue Habib Bourguiba, Bizerte","72434000","gab.bizerte@bhbank.tn","37.2740","9.8730","GAB"),
    ("GAB Kairouan Centre","Kairouan","Avenue Ibn Jazzar, Kairouan","77233000","gab.kairouan@bhbank.tn","36.8080","10.0820","GAB"),
    ("GAB Sahloul","Sousse","Route de Kairouan, Sahloul","73228000","gab.sahloul@bhbank.tn","35.8150","10.6050","GAB"),
    ("GAB Monastir Centre","Monastir","Avenue Habib Bourguiba, Monastir","73464000","gab.monastir@bhbank.tn","35.7780","10.8260","GAB"),
    ("GAB Sakiet Ezzit","Sfax","Route de Tunis, Sakiet Ezzit","74302000","gab.sakietezzit@bhbank.tn","34.8050","10.7600","GAB"),
    ("GAB Gabès Centre","Gabès","Avenue Habib Bourguiba, Gabes","75273000","gab.gabes@bhbank.tn","33.8810","10.0980","GAB"),

    # ===== TUNIS AGENCES =====
    ("BH Bank Bab El Bhar","Tunis","Place de la Victoire, Tunis","71125000","ag.babelbhar@bhbank.tn","36.7990","10.1790","AGENCE"),
    ("BH Bank Carthage","Tunis","Avenue de la Promenade, Carthage, Tunis","71742000","ag.carthage@bhbank.tn","36.8530","10.3230","AGENCE"),
    ("BH Bank La Marsa","Tunis","Avenue Habib Bourguiba, La Marsa, Tunis","71743000","ag.lamarsa@bhbank.tn","36.8780","10.3270","AGENCE"),
    ("BH Bank El Menzah","Tunis","Avenue Hedi Nouira, El Menzah, Tunis","71744000","ag.elmenzah@bhbank.tn","36.8430","10.1670","AGENCE"),
    ("BH Bank El Aouina","Tunis","Rue de l'Aéroport, El Aouina, Tunis","71745000","ag.elaouina@bhbank.tn","36.8330","10.2070","AGENCE"),
    ("Marsa Ville","Tunis","24 Avenue Taieb Mhiri, La Marsa","71127476","ag.marsaville@bhbank.tn","36.8780","10.3270","AGENCE"),
    ("Bureau BH BANK La Kasbah","Tunis","Rue de la Kasbah, Tunis","71127486","ag.kasbah@bhbank.tn","36.7970","10.1660","AGENCE"),
    ("MANZAH 5","Ariana","08 Avenue de la Liberté, Kssar Tej, El Menzah 5, Ariana","71127446","agencecarnoy@bhbank.tn","36.8460","10.1620","AGENCE"),
    ("ENNASR 2","Ariana","18 Résidence TEJ, Immeuble B, Route Etturki, Ennasser II, Ariana","71127452","ag.ennasr2@bhbank.tn","36.8580","10.1650","AGENCE"),
    ("MENZAH 8","Ariana","22 Angle Avenue Mustapha Hjeij et Rue Kehna, EL MENZAH 8, ARIANA","71127444","ag.elmenzah8@bhbank.tn","36.8400","10.1550","AGENCE"),
    ("BH Bank La Soukra","Ariana","Avenue de l'Environnement, La Soukra, Ariana","71706000","ag.lasoukra@bhbank.tn","36.8720","10.2050","AGENCE"),
    ("Jardins de Carthage","Jardins de Carthage","Jardins de Carthage, Tunis","71125000","ag.jardinsdecarthage@bhbank.tn","36.8500","10.3100","AGENCE"),

    # ===== BEN AROUS AGENCES =====
    ("M'HAMIDIA","Ben Arous","Avenue de l'Environnement, M'hamidia, Ben Arous","71387000","ag.mhamidia@bhbank.tn","36.7280","10.2120","AGENCE"),
    ("BOUMHAL","Ben Arous","Route de Boumhal, Ben Arous","71388000","ag.boumhal@bhbank.tn","36.7380","10.2920","AGENCE"),
    ("EZZAHRA","Ben Arous","Avenue Habib Bourguiba, Ezzahra, Ben Arous","71389000","ag.ezzahra@bhbank.tn","36.7480","10.2520","AGENCE"),
    ("MOHAMEDIA","Ben Arous","Avenue de la République, Mohamedia, Ben Arous","71390000","ag.mohamedia@bhbank.tn","36.7180","10.2420","AGENCE"),
    ("RADES","Ben Arous","Avenue Habib Bourguiba, Rades, Ben Arous","71391000","ag.rades@bhbank.tn","36.7680","10.2720","AGENCE"),
    ("Mégrine","Ben Arous","Route de Tunis, Mégrine, Ben Arous","71392000","ag.megrine@bhbank.tn","36.7780","10.2220","AGENCE"),
    ("BH Bank Ben Arous","Ben Arous","Avenue Habib Bourguiba, Ben Arous","71386000","ag.benarous@bhbank.tn","36.7480","10.2220","AGENCE"),

    # ===== MANOUBA AGENCES =====
    ("BH Bank Douar Hicher","Manouba","Avenue de la République, Douar Hicher, Manouba","71602000","ag.douarhicher@bhbank.tn","36.8180","10.0870","AGENCE"),
    ("BH Bank Tebourba","Manouba","Avenue Habib Bourguiba, Tebourba, Manouba","71603000","ag.tebourba@bhbank.tn","36.8280","10.0370","AGENCE"),
    ("TEBOULBA","Monastir","02 Avenue Habib Bourguiba, Téboulba 5080","71272530","a.teboulba@bhbank.tn","35.6350","10.9680","AGENCE"),

    # ===== NABEUL / CAP BON AGENCES =====
    ("BH Bank Korba","Nabeul","Avenue Habib Bourguiba, Korba, Nabeul","72289000","ag.korba@bhbank.tn","36.4480","10.7850","AGENCE"),
    ("BH Bank Kelibia","Nabeul","Avenue de la République, Kelibia, Nabeul","72290000","ag.kelibia@bhbank.tn","36.4180","11.0850","AGENCE"),
    ("BH Bank Nabeul","Nabeul","Avenue Habib Bourguiba, Nabeul","72287000","ag.nabeul@bhbank.tn","36.4560","10.7350","AGENCE"),
    ("BH Bank Hammamet","cap bon","Avenue Habib Bourguiba, Hammamet","72285000","ag.hammamet@bhbank.tn","36.4000","10.5750","AGENCE"),
    ("BH Bank Cap Bon","cap bon","Centre Ville, Cap Bon","72284000","ag.capbon@bhbank.tn","36.4560","10.7350","AGENCE"),

    # ===== BIZERTE AGENCES =====
    ("BH Bank Bizerte","Bizerte","Avenue Habib Bourguiba, Bizerte","72431000","ag.bizerte@bhbank.tn","37.2740","9.8730","AGENCE"),
    ("BH Bank Mateur","Bizerte","Avenue Habib Bourguiba, Mateur, Bizerte","72432000","ag.mateur@bhbank.tn","37.2540","9.8730","AGENCE"),
    ("BH Bank Menzel Bourguiba","Bizerte","Avenue de l'Indépendance, Menzel Bourguiba, Bizerte","72433000","ag.menzel@bhbank.tn","37.2940","9.8730","AGENCE"),
    ("BH Bank Ras Jbel","Bizerte","Avenue Habib Bourguiba, Ras Jbel, Bizerte","72434000","ag.rasjbel@bhbank.tn","37.2330","9.9430","AGENCE"),

    # ===== BEJA AGENCES =====
    ("BH Bank Béja","Béja","Avenue Habib Bourguiba, Béja","78450000","ag.beja@bhbank.tn","36.7330","9.1830","AGENCE"),
    ("BH Bank Medjez El Bab","Béja","Avenue Habib Bourguiba, Medjez El Bab, Béja","78451000","ag.medjez@bhbank.tn","36.7050","9.1610","AGENCE"),
    ("BH Bank Testour","Béja","Avenue de la République, Testour, Béja","78452000","ag.testour@bhbank.tn","36.5550","9.4410","AGENCE"),
    ("NEFZA","Béja","06 Avenue Habib Bourguiba, Nefza, Béja","71127450","ag.nefza@bhbank.tn","36.9560","9.0800","AGENCE"),
    ("BH Bank Téboursouk","Béja","Avenue Habib Bourguiba, Téboursouk, Béja","78453000","ag.teboursouk@bhbank.tn","36.6330","9.2430","AGENCE"),

    # ===== JENDOUBA AGENCES =====
    ("BH Bank Jendouba","Jendouba","Avenue Hédi Chaker, Jendouba","78601000","ag.jendouba@bhbank.tn","36.5010","8.7810","AGENCE"),
    ("BH Bank Tabarka","Jendouba","Avenue Habib Bourguiba, Tabarka, Jendouba","78601000","ag.tabarka@bhbank.tn","36.9510","8.7600","AGENCE"),
    ("BH Bank Ghardimaou","Jendouba","Avenue de la République, Ghardimaou, Jendouba","78602000","ag.ghardimaou@bhbank.tn","36.4510","8.4400","AGENCE"),
    ("BH Bank Fernana","Jendouba","Avenue Habib Bourguiba, Fernana, Jendouba","78603000","ag.fernana@bhbank.tn","36.6550","8.7040","AGENCE"),

    # ===== LE KEF AGENCES =====
    ("BH Bank Le Kef","Le Kef","Avenue Habib Bourguiba, Le Kef","78231000","ag.lekef@bhbank.tn","36.1740","8.7050","AGENCE"),
    ("BH Bank Tajerouine","Le Kef","Avenue Habib Bourguiba, Tajerouine, Le Kef","78231000","ag.tajerouine@bhbank.tn","36.1340","8.5550","AGENCE"),
    ("BH Bank Dahmani","Le Kef","Avenue de la République, Dahmani, Le Kef","78232000","ag.dahmani@bhbank.tn","35.9330","8.8300","AGENCE"),

    # ===== SILIANA AGENCES =====
    ("BH Bank Siliana","Siliana","Avenue Habib Bourguiba, Siliana","78383000","ag.siliana@bhbank.tn","36.0850","9.3700","AGENCE"),
    ("BH Bank Bouarada","Siliana","Avenue Habib Bourguiba, Bouarada, Siliana","78383000","ag.bouarada@bhbank.tn","36.0750","9.3700","AGENCE"),
    ("BH Bank El Krib","Siliana","Avenue Habib Bourguiba, El Krib, Siliana","78384000","ag.elkrib@bhbank.tn","36.2750","9.2550","AGENCE"),

    # ===== KAIROUAN AGENCES =====
    ("BH Bank Kairouan","Kairouan","Avenue Ibn Jazzar, Kairouan","77231000","ag.kairouan@bhbank.tn","36.8080","10.0820","AGENCE"),
    ("BH Bank Sbikha","Kairouan","Avenue Ibn Jazzar, Sbikha, Kairouan","77231000","ag.sbikha@bhbank.tn","35.6580","10.0760","AGENCE"),
    ("BH Bank El Oueslatia","Kairouan","Avenue de la République, El Oueslatia, Kairouan","77232000","ag.eloueslatia@bhbank.tn","35.8380","9.7960","AGENCE"),
    ("SBEITLA","Kairouan","14 Avenue du Parc, Sbeitla","71127392","ag.sbitla@bhbank.tn","35.2280","9.1300","AGENCE"),
    ("BH Bank Haffouz","Kairouan","Avenue Habib Bourguiba, Haffouz, Kairouan","77233000","ag.haffouz@bhbank.tn","35.6380","9.6650","AGENCE"),

    # ===== SOUSSE AGENCES =====
    ("BH Bank Sousse","Sousse","Avenue de la République, Sousse","73221000","ag.sousse@bhbank.tn","35.8256","10.6410","AGENCE"),
    ("BH Bank Hammam Sousse","Sousse","Avenue Habib Bourguiba, Hammam Sousse","73224000","ag.hammamsousse@bhbank.tn","35.8550","10.6050","AGENCE"),
    ("BH Bank Khzema","Sousse","Route de Mahdia, Khzema, Sousse","73225000","ag.khzema@bhbank.tn","35.7950","10.6350","AGENCE"),
    ("SOUSSE MALL","Sousse","Mall Of Sousse Route Nationale 1, Kalaa Kbira","71127467","ag.mallofsousse@bhbank.tn","35.8200","10.5850","AGENCE"),
    ("SOUSSE MENCHIA","Sousse","08 Avenue 14 Janvier, Route touristique Kantaoui, Sousse","71127448","ag.sousseelmenchia@bhbank.tn","35.8950","10.5950","AGENCE"),
    ("SOUSSE BEJAOUI","Sousse","02 Avenue Commandant Bejaoui, Centre Urbain, Sousse","71127440","ag.soussebejaoui@bhbank.tn","35.8280","10.6380","AGENCE"),
    ("KALAA SEGHIRA","Sousse","28 Avenue Habib Bourguiba, Kalaa Sghira","71127434","ag.kalaasghira@bhbank.tn","35.8200","10.5850","AGENCE"),
    ("BH Bank Msaken","Sousse","Angle Avenue Taieb Hachicha et rue Gafsa, Msaken","71127479","ag.msakenennour@bhbank.tn","35.7300","10.5800","AGENCE"),

    # ===== MONASTIR AGENCES =====
    ("BH Bank Monastir","Monastir","Avenue Taieb M'hiri, Monastir","73266000","ag.monastir@bhbank.tn","35.7780","10.8260","AGENCE"),
    ("MONASTIR I","Monastir","12 Avenue Taieb M'hiri, Immeuble Medina, Monastir 5001","71127266","ag.monastir@bhbank.tn","35.7780","10.8260","AGENCE"),
    ("MONASTIR Leader","Monastir","9 Rue du Leader, Monastir 5001","71127311","ag.monastir2@bhbank.tn","35.7800","10.8280","AGENCE"),
    ("BH Bank Ksar Hellal","Monastir","Angle Av. Habib Bourguiba et rue Hédi Nouira, Ksar Hellal 5004","71127297","ag.ksarhellal@bhbank.tn","35.7580","10.8460","AGENCE"),
    ("BH Bank Moknine","Monastir","Avenue de la République, Moknine, Monastir","73463000","ag.moknine@bhbank.tn","35.7880","10.7960","AGENCE"),
    ("JEMMEL","Monastir","45 Rue El Kassas, Jemmel 5003","71127296","ag.jammel@bhbank.tn","35.5000","10.7570","AGENCE"),

    # ===== MAHDIA AGENCES =====
    ("BH Bank Mahdia","Mahdia","Avenue Habib Bourguiba, Mahdia","73312000","ag.mahdia@bhbank.tn","35.5050","11.0620","AGENCE"),
    ("BH Bank Chebba","Mahdia","Avenue Habib Bourguiba, Chebba, Mahdia","73684000","ag.chebba@bhbank.tn","35.4850","11.1120","AGENCE"),
    ("BH Bank Rejiche","Mahdia","Avenue de la République, Rejiche, Mahdia","73685000","ag.rejiche@bhbank.tn","35.5150","11.0320","AGENCE"),
    ("SAYEDA","Mahdia","20 Avenue Habib Bourguiba, Sayeda 5035","71127264","a.sayada@bhbank.tn","35.3480","10.8900","AGENCE"),
    ("KSSOUR ESSAF","Mahdia","17 Boulevard de l'Environnement, Ksour Essef 5180","71127287","ag.ksouressef@bhbank.tn","35.4180","10.9980","AGENCE"),
    ("KARKAR","Mahdia","02 Route Nationale GP1, Karkar 5112","71127295","ag.karkar@bhbank.tn","35.5160","10.8580","AGENCE"),
    ("EL JEM","Mahdia","02 Avenue Hédi Chaker, El Jem 5160","71127403","ag.eljem@bhbank.tn","35.2960","10.7100","AGENCE"),

    # ===== SFAX AGENCES =====
    ("BH Bank Sfax","Sfax","Avenue Hédi Chaker, Sfax","74299000","ag.sfax@bhbank.tn","34.7400","10.7600","AGENCE"),
    ("SFAX Cdt BEJAOUI","Sfax","10 Rue Commandant Bejaoui, Sfax Ville 3000","71127215","ag.sfaxbejaoui@bhbank.tn","34.7400","10.7600","AGENCE"),
    ("SFAX JARDINS","Sfax","18 Cité Jardins Moulin Ville, Sfax Ville 3001","71127237","ag.sfaxjardins@bhbank.tn","34.7450","10.7550","AGENCE"),
    ("SFAX HEDI CHAKER","Sfax","89 Angle Avenue Hedi Chaker et Avenue Habib Thameur, Sfax Ville 3001","71127262","a.sfaxchaker@bhbank.tn","34.7380","10.7620","AGENCE"),
    ("SFAX SAKIT EZZIT","Sfax","48 Route Tunis Km 8, Sfax Sakiet Ezziet 3014","71127293","a.sekietezzit@bhbank.tn","34.8050","10.7600","AGENCE"),
    ("SFAX LAFRANE","Sfax","Route Lafrane KM4, Sfax","71127461","ag.sfaxlafrane@bhbank.tn","34.6850","10.7180","AGENCE"),
    ("MAHRES","Sfax","Route El Korniche, Mahres","71127469","ag.sfaxmahres@bhbank.tn","34.5830","10.5000","AGENCE"),
    ("THYNA","Sfax","Route de Gabes Km 7, Thyna","71127463","ag.sfaxthyna@bhbank.tn","34.6780","10.6650","AGENCE"),
    ("SFAX CHIHIYA","Sfax","Route Teniour KM 5,5, Chihya","71126466","ag.sfaxchihya@bhbank.tn","34.7000","10.7100","AGENCE"),
    ("SFAX EL AIN","Sfax","16 Route El Ain Km 3.5, Sfax","71127454","agencesfaxrouteelain@bhbank.tn","34.7350","10.7800","AGENCE"),
    ("SFAX SIDI MANSOUR","Sfax","16 Route Sidi Mansour Km2, Sfax Sakiet Eddayer 3015","71127294","ag.sfaxsidimanssour@bhbank.tn","34.7920","10.7200","AGENCE"),
    ("SFAX ROUTE DE GABES","Sfax","18 Avenue de l'environnement Route de Gabés, Sfax Sud 3003","71127292","ag.sfaxrtegabes@bhbank.tn","34.7100","10.7400","AGENCE"),
    ("SFAX JEDIDA","Sfax","22 Angle Av 14 Janvier Avenue des Martyrs, Sfax","71127381","ag.sfaxjedida@bhbank.tn","34.7420","10.7580","AGENCE"),
    ("SFAX MENZEL CHAKER","Sfax","06 Route Menzel Chaker erramla center km 3,5, Sfax 3000","71127262","ag.menzelchaker@bhbank.tn","34.7850","10.7600","AGENCE"),
    ("SFAX ROUTE DE GREMDA","Sfax","16 Route Gremda Résidence LYNA km 6,5, Sfax 3080","71127402","ag.gremda@bhbank.tn","34.8200","10.7600","AGENCE"),
    ("SFAX SAKIET EDDAYER","Sfax","34 Avenue Hédi Chaker Route de Mahdia km 7, Sfax","71127436","ag.sakieteddaier@bhbank.tn","34.8050","10.7600","AGENCE"),
    ("BH Bank El Amra","Sfax","Route de Gabès, El Amra, Sfax","74299000","ag.elamra@bhbank.tn","34.7100","10.7400","AGENCE"),
    ("BH Bank El Hencha","Sfax","Avenue de la République, El Hencha, Sfax","74300000","ag.elhencha@bhbank.tn","34.7300","10.7200","AGENCE"),

    # ===== GABES AGENCES =====
    ("BH Bank Gabes","Gabès","174 Avenue Farhat Hached, Gabes 6000","71272600","ag.gabes@bhbank.tn","33.8810","10.0980","AGENCE"),
    ("Gabes Sud","Gabès","Avenue Abu el Kacem Chebbi, 6011 Gabes","71127478","ag.gabessud@bhbank.tn","33.8550","10.0800","AGENCE"),
    ("EL HAMMA","Gabès","Avenue Habib Bourguiba, El Hamma, Gabes","75271000","ag.elhamma@bhbank.tn","33.8910","9.7980","AGENCE"),
    ("MARETH","Gabès","02 Avenue 27 Octobre, Mareth - Gabes 6080","71127219","agence.mareth@bhbank.tn","33.6170","10.2920","AGENCE"),
    ("BH Bank Médenine","Gabès","Avenue Habib Bourguiba, Médenine","75272000","ag.medenine@bhbank.tn","33.3550","10.5050","AGENCE"),
    ("ZARZIS","Gabès","12 Avenue Farhat Hached, Zarzis 4104","71127283","ag.zarzis@bhbank.tn","33.5050","11.1150","AGENCE"),

    # ===== MEDENINE AGENCES =====
    ("BH Bank Medenine","Médenine","6 Avenue Mansour El Houch, Medenine","71375000","ag.medenine@bhbank.tn","33.3550","10.5050","AGENCE"),
    ("BEN GUERDANE","Médenine","12 Avenue de Tunis, Ben Guerdane 4103","71127366","ag.benguerdane@bhbank.tn","33.1450","11.2150","AGENCE"),
    ("JERBA MIDOUN","Médenine","48 Avenue Salah Ben Youssef, Jerba-Midoun 4106","71127364","ag.midoun@bhbank.tn","33.8100","10.9850","AGENCE"),
    ("JERBA MIDOUN BORGO","Médenine","Jerba Midoun Borgo, Djerba","75364000","ag.jerbaborigo@bhbank.tn","33.8680","10.7730","AGENCE"),
    ("Z TOUR","Médenine","Z Tour, Jerba Midoun","75364000","ag.ztour@bhbank.tn","33.8150","10.9900","AGENCE"),
    ("BH Bank Houmet Essouk","Médenine","Avenue Habib Bourguiba, Houmet Essouk, Djerba","75645000","ag.houmet@bhbank.tn","33.8760","10.8570","AGENCE"),

    # ===== TATAOUINE AGENCES =====
    ("BH Bank Tataouine","Tataouine","63 Avenue Farhat Hached, Tataouine Sud 3207","71127314","ag.tataouine@bhbank.tn","32.9300","10.4500","AGENCE"),
    ("BIR LAHMAR","Tataouine","02 Angle Avenue Habib Bourguiba et rue Hannibal, Bir Lahmar 3204","71127379","a.birlahmar@bhbank.tn","32.9160","10.3920","AGENCE"),
    ("BH Bank Remada","Tataouine","Avenue Habib Bourguiba, Remada, Tataouine","75861000","ag.remada@bhbank.tn","32.9150","10.3910","AGENCE"),
    ("BH Bank Ghomrassen","Tataouine","Avenue de la République, Ghomrassen, Tataouine","75862000","ag.ghomrassen@bhbank.tn","33.0580","10.3330","AGENCE"),

    # ===== GAFSA AGENCES =====
    ("BH Bank Gafsa","Gafsa","27 Avenue Taieb M'hiri, Gafsa 2100","71319000","ag.gafsa@bhbank.tn","34.4250","8.7840","AGENCE"),
    ("GAFSA ENNOUR","Gafsa","Rue de Palestine Cité Ennour, Gafsa","71127481","ag.gafsaennour@bhbank.tn","34.4250","8.7840","AGENCE"),
    ("METLAOUI","Gafsa","86 Route Moulares, Gafsa","71127384","ag.metlaoui@bhbank.tn","34.3050","8.4040","AGENCE"),
    ("BH Bank El Ksar","Gafsa","Avenue de la République, El Ksar, Gafsa","76227000","ag.elksar@bhbank.tn","34.4550","8.8040","AGENCE"),
    ("MOULARES","Gafsa","08 Avenue Farhat Hached, Moulares 2110","71127377","a.moularas@bhbank.tn","34.3820","8.2680","AGENCE"),
    ("BH Bank Redeyef","Gafsa","Avenue Habib Bourguiba, Redeyef, Gafsa","76228000","ag.redeyef@bhbank.tn","34.3850","8.1540","AGENCE"),

    # ===== TOZEUR AGENCES =====
    ("BH Bank Tozeur","Tozeur","12 Avenue Farhat Hached, Tozeur 2200","71127281","ag.tozeur@bhbank.tn","33.9190","8.1330","AGENCE"),
    ("NEFTA","Tozeur","Avenue Habib Bourguiba, Nefta, Tozeur","76453000","ag.nefta@bhbank.tn","33.8690","7.8730","AGENCE"),
    ("BH Bank Degache","Tozeur","Avenue de la République, Degache, Tozeur","76454000","ag.degache@bhbank.tn","33.9770","8.2080","AGENCE"),

    # ===== KEBILI AGENCES =====
    ("BH Bank Kébili","Kébili","16 Rue Nalout, Kébili 4200","71272700","ag.kebili@bhbank.tn","33.7040","8.9690","AGENCE"),
    ("DOUZ","Kébili","Avenue Habib Bourguiba, Douz, Kébili","75491000","ag.douz@bhbank.tn","33.4650","9.0240","AGENCE"),
    ("SOUK LAHAD","Kébili","Avenue de la République, Souk Lahad, Kébili","75492000","ag.souklahad@bhbank.tn","33.9050","8.8740","AGENCE"),
    ("BH Bank Jemna","Kébili","Avenue Habib Bourguiba, Jemna, Kébili","75493000","ag.jemna@bhbank.tn","33.5810","9.0140","AGENCE"),

    # ===== KASSERINE AGENCES =====
    ("BH Bank Kasserine","Kasserine","10 Avenue Taieb M'hiri, Kasserine 1200","71352000","ag.kasserine@bhbank.tn","35.1670","8.8360","AGENCE"),
    ("THALA KASSERINE","Kasserine","Angle de l'avenue Habib Bourguiba et rue de Palestine, Thala","71127486","ag.thala@bhbank.tn","35.5720","8.6720","AGENCE"),
    ("BH Bank Sbeitla","Kasserine","14 Avenue du Parc, Sbeitla","78392000","ag.sbeitla@bhbank.tn","35.2280","9.1300","AGENCE"),
    ("BH Bank Feriana","Kasserine","Avenue Habib Bourguiba, Feriana, Kasserine","78393000","ag.feriana@bhbank.tn","34.9630","8.5710","AGENCE"),
    ("BH Bank Ezzouhour","Kasserine","Avenue de la République, Ezzouhour, Kasserine","78394000","ag.ezzouhour@bhbank.tn","35.0500","8.8300","AGENCE"),

    # ===== SIDI BOUZID AGENCES =====
    ("BH Bank Sidi Bouzid","Sidi Bouzid","42 Avenue Habib Bourguiba, Sidi Bouzid 9100","71127269","ag.sidibouzid@bhbank.tn","35.0380","9.4840","AGENCE"),
    ("REGUEB","Sidi Bouzid","Avenue de l'environnement, Route Sidibouzid, Regueb","71127473","ag.regueb@bhbank.tn","34.8600","9.7820","AGENCE"),
    ("BH Bank Meknassy","Sidi Bouzid","Avenue Habib Bourguiba, Meknassy, Sidi Bouzid","71395000","ag.meknassy@bhbank.tn","34.6120","9.5700","AGENCE"),
    ("BH Bank Bir El Hafey","Sidi Bouzid","Avenue de la République, Bir El Hafey, Sidi Bouzid","71396000","ag.birelhafey@bhbank.tn","34.9320","9.1900","AGENCE"),
    ("BH Bank Menzel Bouzaiene","Sidi Bouzid","Avenue Habib Bourguiba, Menzel Bouzaiene, Sidi Bouzid","71397000","ag.menzelbouzaiene@bhbank.tn","34.5830","9.1170","AGENCE"),

    # ===== ZAGHOUAN AGENCES =====
    ("BH Bank Zaghouan","Zaghouan","Avenue Habib Bourguiba, Zaghouan","72677000","ag.zaghouan@bhbank.tn","36.4020","10.1430","AGENCE"),
    ("EL FAHS","Zaghouan","Avenue Habib Bourguiba, El Fahs, Zaghouan","72677000","ag.elfahs@bhbank.tn","36.3830","10.1270","AGENCE"),
    ("DJEBEL EL OUEST","Zaghouan","12 Avenue Tahar Ayari, Djebel El Ouest, Zaghouan","71127456","ag.jebeleloust@bhbank.tn","36.3750","10.1100","AGENCE"),
    ("BH Bank Saouaf","Zaghouan","Avenue de la République, Saouaf, Zaghouan","72678000","ag.saouaf@bhbank.tn","36.7250","10.3080","AGENCE"),
]

created = 0
for name, region_name, address, phone, email, lat, lng, agency_type in AGENCIES:
    region = regions.get(region_name)
    if not region:
        print(f"SKIP: region '{region_name}' not found for '{name}'")
        continue
    obj, was_created = Agency.objects.get_or_create(
        name=name,
        region=region,
        defaults={
            "address": address,
            "phone": phone,
            "email": email,
            "latitude": lat,
            "longitude": lng,
            "agency_type": agency_type,
        },
    )
    if was_created:
        created += 1
        print(f"+ {name} ({region_name}) [{agency_type}]")
    else:
        print(f"= {name} (exists)")

print(f"\n=== Done. Created {created} new agencies. ===")

from collections import Counter
type_counts = Counter(a.agency_type for a in Agency.objects.all())
print("\nBy type:")
for t, c in sorted(type_counts.items()):
    print(f"  {t}: {c}")

region_counts = Counter(a.region.name for a in Agency.objects.all())
print("\nBy region:")
for r, c in sorted(region_counts.items()):
    print(f"  {r}: {c}")
print(f"\nTOTAL: {Agency.objects.count()} agencies")
