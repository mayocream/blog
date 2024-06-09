import feedparser
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

    # Convert the date to ISO format
    parsed_date = datetime.strptime(date, '%a, %d %b %Y %H:%M:%S %z')
    formatted_date = parsed_date.strftime('%Y-%m-%d')

    # Format title and content
    formatted_title = title.replace(" ", "-").lower()
    formatted_content =f"""---
title: "{title}"
date: "{formatted_date}"
externalLink: "{entry_url}"
---

This is the content for the note titled "{title}" published on {formatted_date}.

Read more at: {entry_url}
"""

    # Save the formatted content to a file
    filename = f"./content/posts/note/{formatted_title}.md"
    with open(filename, 'w') as file:
        file.write(formatted_content)
