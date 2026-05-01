from django.db import IntegrityError
from django.contrib.auth import get_user_model

from rest_framework import serializers
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.validators import UniqueTogetherValidator
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import Region, Agency, SensorData

User = get_user_model()
FAILED_LOGIN_MESSAGE = "Wrong email address or password."


class EmailTokenObtainPairSerializer(TokenObtainPairSerializer):
    default_error_messages = {
        "no_active_account": FAILED_LOGIN_MESSAGE,
    }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields.pop("username", None)
        self.fields["email"] = serializers.EmailField(required=True)

    def validate(self, attrs):
        email = attrs.get("email")

        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            raise AuthenticationFailed(
                FAILED_LOGIN_MESSAGE,
                code="no_active_account",
            )

        attrs[self.username_field] = user.username
        return super().validate(attrs)


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
