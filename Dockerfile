# Use an official Node.js runtime as a parent image
FROM node:20
# Set the working directory
WORKDIR /app

# Copy everything
COPY . .

# Install dependencies and build the client
RUN npm install --prefix client && npm run build --prefix client

# Install server dependencies
RUN npm install --prefix server

# Expose the port
EXPOSE 8080

# Start the backend server
CMD ["node", "server/index.js"]
