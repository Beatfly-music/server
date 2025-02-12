#!/bin/bash
# setup_mysql_dialog.sh
# This script uses the dialog terminal GUI to fully configure and launch a MySQL Docker container.
# It auto-installs required packages (dialog and Docker if missing on Debian/Ubuntu),
# prompts the user for configuration details,
# pulls the latest MySQL image,
# removes any existing container with the same name,
# creates and starts the container,
# waits for initialization,
# and optionally loads a schema.sql file if it exists.

#Beatfly SQL

# ---------------------------
# Function to check/install packages via apt-get
# ---------------------------
install_package_if_missing() {
  PACKAGE="$1"
  if ! dpkg -s "$PACKAGE" >/dev/null 2>&1; then
    dialog --infobox "Installing $PACKAGE..." 3 40
    sudo apt-get update && sudo apt-get install -y "$PACKAGE"
  fi
}

# ---------------------------
# Check if 'dialog' is installed; if not, install it.
# ---------------------------
if ! command -v dialog >/dev/null 2>&1; then
  echo "dialog not found. Attempting to install it..."
  install_package_if_missing dialog
fi

# ---------------------------
# Check if Docker is installed; if not, ask the user and install it.
# ---------------------------
if ! command -v docker >/dev/null 2>&1; then
  dialog --yesno "Docker is not installed. Would you like to install Docker now?" 7 60
  response=$?
  if [ $response -eq 0 ]; then
    dialog --infobox "Installing Docker (docker.io)..." 3 50
    sudo apt-get update && sudo apt-get install -y docker.io
    # Verify installation.
    if ! command -v docker >/dev/null 2>&1; then
      dialog --msgbox "Docker installation failed. Please install Docker manually and re-run the script." 6 60
      exit 1
    fi
  else
    dialog --msgbox "Docker is required. Exiting." 6 40
    exit 1
  fi
fi

# (Optional) Add a message that Docker commands may require sudo if the user is not in the docker group.
if ! groups "$USER" | grep -q "\bdocker\b"; then
  dialog --msgbox "Note: Your user is not in the Docker group. You may need to prefix Docker commands with 'sudo'." 6 60
fi

# ---------------------------
# Prompt for configuration details using dialog --form
# ---------------------------
CONFIG_FILE=$(mktemp)
dialog --title "MySQL Docker Setup" \
  --form "Enter configuration details:" 15 60 0 \
  "Container Name:"   1 1 "beatfly-mysql"   1 20 20 0 \
  "Root Password:"    2 1 "yourpassword"    2 20 20 0 \
  "Database Name:"    3 1 "music_service"   3 20 20 0 \
  "Host Port:"        4 1 "3306"            4 20 20 0 2> "$CONFIG_FILE"

if [ $? -ne 0 ]; then
  dialog --msgbox "Setup cancelled by user." 5 30
  rm -f "$CONFIG_FILE"
  exit 1
fi

# Read the configuration values.
CONTAINER_NAME=$(sed -n '1p' "$CONFIG_FILE")
MYSQL_ROOT_PASSWORD=$(sed -n '2p' "$CONFIG_FILE")
MYSQL_DATABASE=$(sed -n '3p' "$CONFIG_FILE")
HOST_PORT=$(sed -n '4p' "$CONFIG_FILE")
rm -f "$CONFIG_FILE"

# Confirm configuration with the user.
dialog --yesno "Configuration Summary:
Container Name: $CONTAINER_NAME
Root Password: $MYSQL_ROOT_PASSWORD
Database: $MYSQL_DATABASE
Host Port: $HOST_PORT

Proceed?" 10 60

if [ $? -ne 0 ]; then
  dialog --msgbox "Setup cancelled by user." 5 30
  exit 1
fi

# ---------------------------
# Pull the latest MySQL image.
# ---------------------------
dialog --infobox "Pulling the latest MySQL image (mysql:8)..." 3 50
sudo docker pull mysql:8 >/dev/null

# ---------------------------
# Remove any existing container with the same name.
# ---------------------------
EXISTING=$(sudo docker ps -aq -f name="^/${CONTAINER_NAME}$")
if [ -n "$EXISTING" ]; then
  dialog --infobox "Removing existing container '${CONTAINER_NAME}'..." 3 50
  sudo docker rm -f ${CONTAINER_NAME} >/dev/null 2>&1
fi

# ---------------------------
# Run the MySQL container (this creates it).
# ---------------------------
dialog --infobox "Starting MySQL container '${CONTAINER_NAME}'..." 3 50
sudo docker run --name ${CONTAINER_NAME} \
  -e MYSQL_ROOT_PASSWORD=${MYSQL_ROOT_PASSWORD} \
  -e MYSQL_DATABASE=${MYSQL_DATABASE} \
  -p ${HOST_PORT}:3306 \
  -d mysql:8 >/dev/null

# ---------------------------
# Wait for MySQL to initialize.
# ---------------------------
dialog --infobox "Waiting for MySQL to initialize (approx. 20 seconds)..." 3 60
sleep 20

# ---------------------------
# Optionally load the schema if schema.sql exists.
# ---------------------------
if [ -f "./schema.sql" ]; then
  dialog --infobox "Loading schema.sql into the database..." 3 50
  sudo docker exec -i ${CONTAINER_NAME} mysql -uroot -p${MYSQL_ROOT_PASSWORD} ${MYSQL_DATABASE} < schema.sql
fi

# ---------------------------
# Final message
# ---------------------------
dialog --msgbox "MySQL server is running on port ${HOST_PORT} with database '${MYSQL_DATABASE}'.
You can connect with:
  mysql -h 127.0.0.1 -P ${HOST_PORT} -u root -p${MYSQL_ROOT_PASSWORD}" 8 70

# Clear the dialog screen.
clear
