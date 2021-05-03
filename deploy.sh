#!/bin/sh
docker-compose -f zip.compose.yaml up --force-recreate --build -d
