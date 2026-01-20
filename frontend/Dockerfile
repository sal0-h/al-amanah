# Build stage
FROM node:20-alpine as build

WORKDIR /app

# Copy package.json (package-lock.json may not exist)
COPY package.json ./

# Install dependencies
RUN npm install

# Copy source files
COPY . .

# Build the app
RUN npm run build

# Production stage - copy built files to a volume
FROM alpine:latest
COPY --from=build /app/dist /dist
CMD ["cp", "-r", "/dist/.", "/output/"]
