FROM denoland/deno:2.0.0

WORKDIR /app

# Copy dependency files first for better caching
COPY deno.jsonc import_map.json ./

# Copy source code
COPY . .

# Cache dependencies
RUN deno cache --lock=deno.lock --import-map=import_map.json main.ts

# Expose the application port
EXPOSE 8000

# Run the application
CMD ["deno", "run", "-A", "--import-map=import_map.json", "main.ts"]

