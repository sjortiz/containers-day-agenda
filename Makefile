.DEFAULT_GOAL := help

.PHONY: help install dev test test-watch typecheck check build preview icons

help: ## Muestra los comandos disponibles
	@awk 'BEGIN {FS = ":.*## "; printf "Uso: make <comando>\n\n"} /^[a-zA-Z_-]+:.*## / {printf "  %-12s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

install: ## Instala las dependencias reproduciblemente
	npm ci

dev: ## Inicia el servidor local de desarrollo
	npm run dev

test: ## Ejecuta todas las pruebas
	npm test

test-watch: ## Ejecuta las pruebas al detectar cambios
	npm run test:watch

typecheck: ## Comprueba los tipos sin generar archivos
	npx tsc --noEmit

check: test typecheck ## Ejecuta pruebas y comprobación de tipos

build: ## Genera el export estático de producción
	npm run build

preview: build ## Sirve localmente el export de producción
	npx serve out

icons: ## Regenera los iconos de la PWA
	npm run make-icons
