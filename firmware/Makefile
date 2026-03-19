# EV Diagnostic — ESP32-S3 firmware
# Richiede PlatformIO (pio in PATH).

.PHONY: build upload uploadfs upload_all monitor

build:
	pio run

upload:
	pio run --target upload

uploadfs:
	pio run --target uploadfs

# Filesystem + firmware in un colpo solo (consigliato dopo modifiche a data/ o sorgenti).
upload_all: uploadfs upload

monitor:
	pio device monitor
