# Use Node 20 (to match your required Node.js version)
FROM node:20

# Set the working directory
WORKDIR /app

# Copy package.json files first for better caching
COPY client/package.json client/package-lock.json ./client/
COPY server/package.json server/package-lock.json ./server/

# Force a clean install of dependencies
RUN rm -rf /app/client/node_modules /app/server/node_modules
RUN npm install --prefix client && npm install --prefix server

# Copy the entire project (after installing dependencies to optimize caching)
COPY . .

# Fix permissions issue for node_modules binaries
RUN chmod -R 777 /app/client/node_modules/.bin

# Build the frontend
RUN npm run build --prefix client

# Expose the server port
EXPOSE 8080

# Start the backend server
CMD ["node", "server/index.js"]
