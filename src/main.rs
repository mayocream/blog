use rocks::Site;

fn main() {
    let mut site = Site::new("Mayo Rocks", "Mayo's blog");
    site.load_posts();
}
