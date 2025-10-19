'use client';

import { useEffect, useState } from 'react';

interface BlogPostData {
  url: string;
  title: string;
  date: string;
  author?: string;
  content: string;
  featured_image?: string;
  images?: Array<{
    src: string;
    alt: string;
  }>;
}

export default function Home() {
  const [posts, setPosts] = useState<BlogPostData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    fetch('/blog_posts.json')
      .then(res => {
        if (!res.ok) throw new Error('Failed to load posts');
        return res.json();
      })
      .then(data => {
        const sortedPosts = data.sort((a: BlogPostData, b: BlogPostData) => {
          return new Date(a.date).getTime() - new Date(b.date).getTime();
        });
        setPosts(sortedPosts);
        setLoading(false);
      })
      .catch(err => {
        console.error('Error:', err);
        setError(err.message);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      const windowHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight - windowHeight;
      const scrolled = window.scrollY;
      const progress = scrolled / documentHeight;
      setScrollProgress(Math.min(Math.max(progress, 0), 1));
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return dateString;
    }
  };

  // Get contrasting color for date badge
  const getContrastColor = (imageSrc: string): string => {
    // Generate a color based on the image URL hash
    const hash = imageSrc.split('').reduce((acc, char) => {
      return char.charCodeAt(0) + ((acc << 5) - acc);
    }, 0);
    
    const colors = [
      'bg-blue-500/90',
      'bg-green-500/90',
      'bg-purple-500/90',
      'bg-orange-500/90',
      'bg-pink-500/90',
      'bg-teal-500/90',
      'bg-indigo-500/90',
      'bg-red-500/90',
    ];
    
    return colors[Math.abs(hash) % colors.length];
  };

  // Find the widest image (best aspect ratio)
  const findWidestImage = (images?: Array<{ src: string; alt: string }>) => {
    if (!images || images.length === 0) return null;
    
    // Simple heuristic: look for landscape images (wider URLs often indicate landscape)
    // In a real scenario, you'd load and check actual dimensions, but this is client-side heuristic
    return images[0]; // For now, use first image as featured
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-neutral-300 border-t-neutral-900 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-neutral-500 text-sm">Loading journal entries...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <p className="text-red-600">Error loading posts: {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-white">
      {/* Appalachian Trail Scroll Indicator - Smaller height for better visibility */}
      <div className="fixed left-8 top-0 h-screen hidden lg:flex items-center z-50 pointer-events-none">
        <div className="relative h-[50vh]">
          {/* SVG Trail - Winding path like a hiking trail */}
          <svg
            viewBox="0 0 60 400"
            className="h-full w-16"
            preserveAspectRatio="xMidYMid meet"
          >
            <path
              id="trail-path"
              d="M30,0 C35,25 25,50 30,75 C35,100 38,125 32,150 C26,175 28,200 35,225 C42,250 25,275 30,300 C35,325 40,350 28,375 C25,390 30,395 30,400"
              fill="none"
              stroke="#e5e5e5"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </svg>
          
          {/* Progress Dot */}
          <div
            className="absolute left-1/2 -translate-x-1/2 w-3 h-3 bg-neutral-900 rounded-full shadow-lg transition-all duration-75 ease-out"
            style={{
              top: `${scrollProgress * 100}%`,
              transform: `translate(-50%, -50%)`,
            }}
          />
          
          {/* Optional: Start and End markers */}
          <div className="absolute left-1/2 -translate-x-1/2 top-0 w-1.5 h-1.5 bg-green-600 rounded-full" />
          <div className="absolute left-1/2 -translate-x-1/2 bottom-0 w-1.5 h-1.5 bg-red-600 rounded-full" />
        </div>
      </div>

      {/* Main Content */}
      <main className="lg:ml-24">
        {/* Header */}
        <header className="border-b border-neutral-100">
          <div className="max-w-3xl mx-auto px-6 py-16 lg:py-20">
            <h1 className="text-5xl lg:text-6xl font-light tracking-tight text-neutral-900 mb-3 font-serif">
              Karlowitz
            </h1>
            <p className="text-neutral-500 text-lg">{posts.length} updates from mostly outside</p>
          </div>
        </header>

        {/* Posts */}
        <div className="max-w-6xl mx-auto px-6 py-12 lg:py-16">
          {posts.map((post, index) => {
            const featuredImage = findWidestImage(post.images);
            
            return (
              <article 
                key={post.url || index} 
                className="mb-16 lg:mb-24 pb-16 lg:pb-24 border-b border-neutral-100 last:border-0"
              >
                {/* Featured Image with Title Overlay */}
                {featuredImage && (
                  <div className="mx-auto mb-8" style={{ maxWidth: '80%' }}>
                    <div className="relative overflow-hidden rounded-sm">
                      <img
                        src={featuredImage.src}
                        alt={featuredImage.alt || post.title}
                        className="w-full h-[600px] object-cover"
                        style={{ objectPosition: 'center' }}
                        loading="lazy"
                      />
                      
                      {/* Date Badge - Top Right */}
                      <div className={`absolute top-4 right-4 ${getContrastColor(featuredImage.src)} text-white text-xs font-medium px-3 py-1.5 rounded-full shadow-lg`}>
                        {formatDate(post.date)}
                      </div>
                      
                      {/* Title Overlay with Extended Gradient */}
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-white via-white/98 via-30% to-transparent pt-32 pb-6 px-6">
                        <h2 className="text-3xl lg:text-4xl font-light text-neutral-800 leading-tight font-serif">
                          {post.title}
                        </h2>
                      </div>
                    </div>
                  </div>
                )}

                {/* Content */}
                <div className="max-w-3xl mx-auto px-6 lg:px-0">
                  <div className="prose prose-lg max-w-none mb-8">
                    <p className="text-neutral-700 leading-relaxed whitespace-pre-line">
                      {post.content}
                    </p>
                  </div>

                  {/* Masonry Grid for All Images */}
                  {post.images && post.images.length > 0 && (
                    <div className="columns-2 gap-4 space-y-4 mt-8">
                      {post.images.map((image, imgIndex) => (
                        <div key={imgIndex} className="break-inside-avoid mb-4">
                          <img
                            src={image.src}
                            alt={image.alt || post.title}
                            className="w-full h-auto object-cover rounded-sm shadow-sm hover:shadow-md transition-shadow duration-200"
                            loading="lazy"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>

        {/* Footer */}
        <footer className="border-t border-neutral-100 mt-16">
          <div className="max-w-3xl mx-auto px-6 py-8 text-center">
            <p className="text-xs text-neutral-400 tracking-wide">
              © {new Date().getFullYear()}
            </p>
          </div>
        </footer>
      </main>
    </div>
  );
}
