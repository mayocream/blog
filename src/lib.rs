#![allow(unused)]

use glob::glob;

struct Post {
    title: String,
    date: String,
    content: String,
}

pub struct Site {
    name: String,
    description: String,
    posts: Vec<Post>,
}

impl Site {
    pub fn new(name: &str, description: &str) -> Site {
        Site {
            name: name.to_string(),
            description: description.to_string(),
            posts: Vec::new(),
        }
    }

    pub fn load_posts(&mut self) {
        for entry in glob("content/**/*.md").expect("Failed to read glob pattern") {
            match entry {
                Ok(path) => {
                    println!("{:?}", path.display());
                }
                Err(e) => panic!("{:?}", e),
            }
        }
    }
}
