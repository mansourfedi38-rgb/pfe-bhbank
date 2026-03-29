from django.db import IntegrityError

from rest_framework import serializers
from rest_framework.validators import UniqueTogetherValidator

from .models import Region, Agency, SensorData


class RegionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Region
        fields = "__all__"


class AgencySerializer(serializers.ModelSerializer):
    class Meta:
        model = Agency
        fields = "__all__"


class SensorDataSerializer(serializers.ModelSerializer):
    class Meta:
        model = SensorData
        fields = "__all__"
        validators = [
            UniqueTogetherValidator(
                queryset=SensorData.objects.all(),
                fields=("agency", "timestamp"),
            )
        ]

    def _raise_if_duplicate_agency_timestamp(self, exc):
        msg = str(exc).lower()
        if "sensor_data_agency_timestamp_uniq" in msg:
            return True
        if "unique constraint" in msg and "agency_id" in msg and "timestamp" in msg:
            return True
        return False

    def create(self, validated_data):
        try:
            return super().create(validated_data)
        except IntegrityError as exc:
            if self._raise_if_duplicate_agency_timestamp(exc):
                raise serializers.ValidationError(
                    {
                        "non_field_errors": [
                            "A record for this agency and timestamp already exists."
                        ]
                    }
                ) from exc
            raise

    def update(self, instance, validated_data):
        try:
            return super().update(instance, validated_data)
        except IntegrityError as exc:
            if self._raise_if_duplicate_agency_timestamp(exc):
                raise serializers.ValidationError(
                    {
                        "non_field_errors": [
                            "A record for this agency and timestamp already exists."
                        ]
                    }
                ) from exc
            raise