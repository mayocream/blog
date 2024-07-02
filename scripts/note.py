import feedparser
import requests
from bs4 import BeautifulSoup
from markdownify import markdownify
from datetime import datetime

# Read URL from .note file
with open('.note', 'r') as file:
    url = file.read().strip()

# Append "/rss" to the URL
rss_url = url + "/rss"

# Parse the RSS feed
feed = feedparser.parse(rss_url)

# Extract title, URL, and date from each entry in the feed
for entry in feed.entries:
    title = entry.title
    entry_url = entry.link
    date = entry.published

    # Convert the date to ISO format with timezone
    parsed_date = datetime.strptime(date, '%a, %d %b %Y %H:%M:%S %z')
    formatted_date = parsed_date.isoformat()

    # Fetch the HTML content from the entry URL
    response = requests.get(entry_url)
    html_content = response.content

    # Parse the HTML content
    soup = BeautifulSoup(html_content, 'html.parser')
    content_div = soup.find(class_='note-common-styles__textnote-body')

    # Convert the HTML content to Markdown
    if content_div:
        markdown_content = markdownify(str(content_div))
    else:
        markdown_content = "Content not found."

    # Format title and content
    formatted_title = title.replace(" ", "-").lower()
    formatted_content = f"""---
title: "{title}"
date: "{formatted_date}"
toc: false
typeface: serif
---

> This is the content for the note titled "{title}" published on [{entry_url}]({entry_url}).

{markdown_content}
"""

    # Save the formatted content to a file
    filename = f"./content/posts/note/{formatted_title}.md"
    with open(filename, 'w') as file:
        file.write(formatted_content)
