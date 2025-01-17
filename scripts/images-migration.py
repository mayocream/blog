import os
import re
import shutil
from pathlib import Path
from typing import Dict, List, Set, Tuple
from datetime import datetime
from collections import defaultdict

class HugoToNextjsMigration:
    def __init__(self, content_dir: str, public_dir: str):
        self.content_dir = Path(content_dir)
        self.public_dir = Path(public_dir)
        self.image_extensions = {'.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'}
        self.image_mapping: Dict[str, str] = {}
        self.date_counters = defaultdict(int)  # Track number of images per date

    def find_markdown_files(self) -> List[Path]:
        """Find all markdown files in the content directory."""
        return list(self.content_dir.glob("**/*.md"))

    def find_images(self) -> List[Path]:
        """Find all image files in the content directory."""
        image_files = []
        for ext in self.image_extensions:
            image_files.extend(self.content_dir.glob(f"**/*{ext}"))
        return image_files

    def get_image_date(self, image_path: Path) -> str:
        """
        Get the date for the image based on the folder structure or file modification time.
        Returns date in YYYY-MM-DD format.
        """
        # Try to extract date from the path (assuming content/posts/YYYY/MM/... structure)
        parts = image_path.parts
        try:
            # Look for year and month in the path
            for i, part in enumerate(parts):
                if part.isdigit() and len(part) == 4:  # Year
                    year = part
                    if i + 1 < len(parts) and parts[i + 1].isdigit() and len(parts[i + 1]) <= 2:  # Month
                        month = parts[i + 1].zfill(2)
                        return f"{year}-{month}-01"
        except (IndexError, ValueError):
            pass

        # Fallback to file modification time
        mtime = os.path.getmtime(image_path)
        return datetime.fromtimestamp(mtime).strftime('%Y-%m-%d')

    def generate_new_image_path(self, original_path: Path) -> Path:
        """Generate a new path for the image in the public directory."""
        date = self.get_image_date(original_path)
        self.date_counters[date] += 1
        new_filename = f"{date}-{str(self.date_counters[date]).zfill(2)}{original_path.suffix}"
        return self.public_dir / 'images' / new_filename

    def move_images(self) -> None:
        """Move all images to the public directory and create mapping."""
        # Create public images directory if it doesn't exist
        (self.public_dir / 'images').mkdir(parents=True, exist_ok=True)

        # Sort images by date to ensure consistent numbering
        images = self.find_images()
        sorted_images = sorted(images, key=lambda x: (self.get_image_date(x), str(x)))

        for image_path in sorted_images:
            new_path = self.generate_new_image_path(image_path)
            # Store the mapping of old path to new path
            self.image_mapping[str(image_path.relative_to(self.content_dir))] = f'/images/{new_path.name}'
            # Move the image
            shutil.copy2(image_path, new_path)
            print(f"Moved: {image_path} -> {new_path}")

    def update_markdown_content(self, content: str) -> str:
        """Update markdown content with new image paths."""
        # Regular expressions for different markdown image syntaxes
        patterns = [
            r'!\[(.*?)\]\((.*?)\)',  # ![alt](src)
            r'<img.*?src=[\'\"](.*?)[\'\"].*?>'  # <img src="src" />
        ]

        updated_content = content
        for pattern in patterns:
            def replace_path(match):
                if pattern == patterns[0]:  # Markdown syntax
                    alt_text, img_path = match.groups()
                    img_path = img_path.split(' ')[0]  # Remove any title after the path
                else:  # HTML syntax
                    img_path = match.group(1)

                # Clean the path
                img_path = img_path.strip()
                if img_path.startswith('./'):
                    img_path = img_path[2:]

                # Try to find the new path in our mapping
                for old_path, new_path in self.image_mapping.items():
                    if old_path.endswith(img_path) or img_path.endswith(old_path):
                        if pattern == patterns[0]:
                            return f'![{alt_text}]({new_path})'
                        else:
                            return f'<img src="{new_path}" />'

                print(f"Warning: Could not find mapping for image: {img_path}")
                return match.group(0)

            updated_content = re.sub(pattern, replace_path, updated_content)

        return updated_content

    def process_markdown_files(self) -> None:
        """Process all markdown files and update image references."""
        for md_file in self.find_markdown_files():
            print(f"Processing: {md_file}")

            # Read the original content
            with open(md_file, 'r', encoding='utf-8') as f:
                content = f.read()

            # Update the content
            updated_content = self.update_markdown_content(content)

            # Write the updated content
            with open(md_file, 'w', encoding='utf-8') as f:
                f.write(updated_content)

    def run(self):
        """Run the complete migration process."""
        print("Starting migration process...")
        self.move_images()
        self.process_markdown_files()
        print("Migration completed!")


if __name__ == "__main__":
    # Configuration
    CONTENT_DIR = "content/posts"
    PUBLIC_DIR = "public"

    # Run migration
    migrator = HugoToNextjsMigration(CONTENT_DIR, PUBLIC_DIR)
    migrator.run()
