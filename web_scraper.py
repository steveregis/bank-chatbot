import requests
from bs4 import BeautifulSoup
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
import os
import json

def scrape_with_selenium(url):
    """
    Scrape the content of a webpage using Selenium to handle JavaScript-rendered content.

    Args:
        url (str): The URL of the webpage to scrape.

    Returns:
        str: The visible text content of the page.
    """
    try:
        # Setup Selenium WebDriver
        options = webdriver.ChromeOptions()
        options.add_argument("--headless")  # Run in headless mode
        options.add_argument("--disable-gpu")
        options.add_argument("--no-sandbox")
        driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)

        # Load the webpage
        driver.get(url)

        # Extract the visible text
        content = driver.find_element(By.TAG_NAME, "body").text
        driver.quit()
        return content

    except Exception as e:
        print(f"Error using Selenium for {url}: {e}")
        return ""

def scrape_and_save(url, output_dir):
    """
    Scrapes the content of a webpage and saves it to a text file.

    Args:
        url (str): The URL of the webpage to scrape.
        output_dir (str): The directory to save the scraped content.
    """
    try:
        # Try with requests first
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        soup = BeautifulSoup(response.content, "html.parser")
        texts = soup.stripped_strings
        content = "\n".join(texts)

        # Fallback to Selenium if content is empty
        if not content.strip():
            print(f"Falling back to Selenium for URL: {url}")
            content = scrape_with_selenium(url)

        if not content.strip():
            print(f"Warning: No meaningful content found for URL: {url}")
            with open("empty_urls.log", "a", encoding="utf-8") as log_file:
                log_file.write(f"{url}\n")
            return

        # Generate a valid filename from the URL
        file_name = url.replace("http://", "").replace("https://", "").replace("/", "_").replace("?", "_").replace("&", "_")[:100] + ".txt"
        file_path = os.path.join(output_dir, file_name)

        # Save the content to a file
        with open(file_path, "w", encoding="utf-8") as file:
            file.write(content)

        print(f"Content saved for URL: {url}")

    except requests.exceptions.RequestException as e:
        print(f"Error fetching {url}: {e}")

    except Exception as e:
        print(f"Unexpected error for {url}: {e}")

def load_config(config_file):
    """
    Loads the configuration file containing website data.

    Args:
        config_file (str): Path to the configuration file.

    Returns:
        dict: Parsed configuration data.
    """
    try:
        with open(config_file, "r", encoding="utf-8") as file:
            return json.load(file)
    except Exception as e:
        print(f"Error loading configuration file: {e}")
        return {}

if __name__ == "__main__":
    config = load_config("config.json")

    if not config:
        print("Configuration not loaded. Exiting.")
        exit(1)

    output_directory = "scraped_data"
    if not os.path.exists(output_directory):
        os.makedirs(output_directory)

    for website in config.get("websites", []):
        base_url = website.get("base_url")
        paths = website.get("paths", [])

        for path in paths:
            full_url = f"{base_url}/{path}"
            scrape_and_save(full_url, output_directory)
