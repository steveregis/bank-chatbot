import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin

# Define the website URL
base_url = "https://www.dib.ae"

# Function to fetch and extract URLs
def get_all_links(url):
    try:
        response = requests.get(url)
        response.raise_for_status()
        soup = BeautifulSoup(response.text, "html.parser")
        links = set()  # Use a set to avoid duplicates
        
        for a_tag in soup.find_all("a", href=True):
            full_url = urljoin(base_url, a_tag["href"])
            if base_url in full_url:  # Include only internal links
                links.add(full_url)
        
        return links
    except Exception as e:
        print(f"Error: {e}")
        return []

# Fetch and print all links
all_links = get_all_links(base_url)
for link in sorted(all_links):
    print(link)
