'use client';

import { useEffect, useState, useRef } from 'react';

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

interface LightboxState {
  isOpen: boolean;
  currentImageIndex: number;
  postIndex: number;
}

export default function Home() {
  const [posts, setPosts] = useState<BlogPostData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [lightbox, setLightbox] = useState<LightboxState>({
    isOpen: false,
    currentImageIndex: 0,
    postIndex: 0,
  });
  const [shareSuccess, setShareSuccess] = useState<string | null>(null);
  const postRefs = useRef<{ [key: string]: HTMLElement | null }>({});
  const expandedItemRef = useRef<HTMLElement | null>(null);
  const expandedGridRef = useRef<HTMLElement | null>(null);
  const originalScrollYRef = useRef<number | null>(null);
  const isForwardScrollRef = useRef<boolean>(false);

  // Create slug from post title for URL
  const createSlug = (title: string): string => {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  };

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

  // Handle deep linking - scroll to post from URL hash
  useEffect(() => {
    if (posts.length === 0) return;

    const hash = window.location.hash.slice(1); // Remove the # character
    if (hash) {
      // Small delay to ensure DOM is ready
      setTimeout(() => {
        const element = postRefs.current[hash];
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
          // Add a subtle highlight effect
          element.style.backgroundColor = 'rgba(59, 130, 246, 0.05)';
          setTimeout(() => {
            element.style.backgroundColor = '';
          }, 2000);
        }
      }, 100);
    }
  }, [posts]);

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

  // Keyboard navigation for lightbox
  useEffect(() => {
    if (!lightbox.isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeLightbox();
      } else if (e.key === 'ArrowLeft') {
        navigateLightbox('prev');
      } else if (e.key === 'ArrowRight') {
        navigateLightbox('next');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightbox]);

  // Masonry (CSS Grid) row-span calculation
  useEffect(() => {
    const grids = Array.from(document.querySelectorAll<HTMLElement>('.masonry-grid'));

    const getRowMetrics = (grid: HTMLElement) => {
      const styles = window.getComputedStyle(grid);
      const rowHeight = parseFloat(styles.getPropertyValue('grid-auto-rows')) || 8;
      const rowGap = parseFloat(styles.getPropertyValue('row-gap')) || 16;
      return { rowHeight, rowGap };
    };

    const computeSpan = (item: HTMLElement, grid: HTMLElement) => {
      const { rowHeight, rowGap } = getRowMetrics(grid);
      const content = (item.querySelector('img') as HTMLElement) || item;
      const height = content.getBoundingClientRect().height;
      const rowSpan = Math.max(1, Math.ceil((height + rowGap) / (rowHeight + rowGap)));
      item.style.gridRowEnd = `span ${rowSpan}`;
    };

    const resizeAll = () => {
      grids.forEach(grid => {
        const items = Array.from(grid.querySelectorAll<HTMLElement>('.masonry-item'));
        items.forEach(item => computeSpan(item, grid));
      });
    };

    // Recompute on image load
    const imgListeners: Array<() => void> = [];
    grids.forEach(grid => {
      const imgs = Array.from(grid.querySelectorAll<HTMLImageElement>('img'));
      imgs.forEach(img => {
        const handler = () => {
          const item = img.closest('.masonry-item') as HTMLElement | null;
          if (item) computeSpan(item, grid);
        };
        if (img.complete) {
          handler();
        } else {
          img.addEventListener('load', handler);
          img.addEventListener('error', handler);
          imgListeners.push(() => {
            img.removeEventListener('load', handler);
            img.removeEventListener('error', handler);
          });
        }
      });
    });

    // Initial and on resize
    resizeAll();
    window.addEventListener('resize', resizeAll);

    return () => {
      window.removeEventListener('resize', resizeAll);
      imgListeners.forEach(off => off());
    };
  }, [posts]);

  // Lightbox functions
  const openLightbox = (postIndex: number, imageIndex: number) => {
    setLightbox({
      isOpen: true,
      currentImageIndex: imageIndex,
      postIndex,
    });
    // Prevent body scroll when lightbox is open
    document.body.style.overflow = 'hidden';
  };

  const closeLightbox = () => {
    setLightbox({
      isOpen: false,
      currentImageIndex: 0,
      postIndex: 0,
    });
    document.body.style.overflow = 'unset';
  };

  const navigateLightbox = (direction: 'prev' | 'next') => {
    const currentPost = posts[lightbox.postIndex];
    if (!currentPost?.images) return;

    const totalImages = currentPost.images.length;
    let newIndex = lightbox.currentImageIndex;

    if (direction === 'next') {
      newIndex = (lightbox.currentImageIndex + 1) % totalImages;
    } else {
      newIndex = (lightbox.currentImageIndex - 1 + totalImages) % totalImages;
    }

    setLightbox(prev => ({ ...prev, currentImageIndex: newIndex }));
  };

  // Share functionality
  const sharePost = async (post: BlogPostData, index: number) => {
    const slug = createSlug(post.title);
    const shareUrl = `${window.location.origin}${window.location.pathname}#${slug}`;
    
    const shareData = {
      title: post.title,
      text: `Check out this post: ${post.title}`,
      url: shareUrl,
    };

    try {
      // Try native share API first (mobile)
      if (navigator.share) {
        await navigator.share(shareData);
        setShareSuccess(slug);
      } else {
        // Fallback to clipboard
        await navigator.clipboard.writeText(shareUrl);
        setShareSuccess(slug);
      }
      
      // Clear success message after 3 seconds
      setTimeout(() => setShareSuccess(null), 3000);
    } catch (err) {
      console.error('Error sharing:', err);
    }
  };

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
            const slug = createSlug(post.title);
            
            return (
              <article 
                key={post.url || index} 
                ref={(el) => { postRefs.current[slug] = el; }}
                className="mb-16 lg:mb-24 pb-16 lg:pb-24 border-b border-neutral-100 last:border-0 transition-colors duration-500"
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
                  {/* Share Button */}
                  <div className="flex justify-end mb-4">
                    <button
                      onClick={() => sharePost(post, index)}
                      className="group flex items-center gap-2 text-sm text-neutral-500 hover:text-neutral-900 transition-colors"
                      aria-label="Share post"
                    >
                      {shareSuccess === slug ? (
                        <>
                          <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          <span className="text-green-600">Link copied!</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                          </svg>
                          <span>Share</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="prose prose-lg max-w-none mb-8">
                    <p className="text-neutral-700 leading-relaxed whitespace-pre-line">
                      {post.content}
                    </p>
                  </div>

                  {/* Masonry Grid for All Images */}
                  {post.images && post.images.length > 0 && (
                    <div className="masonry-grid grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
                      {post.images.map((image, imgIndex) => (
                        <div 
                          key={imgIndex}
                          data-image-index={imgIndex}
                          className="masonry-item relative transition-all duration-500 ease-out"
                          onMouseEnter={(e) => {
                            if (isForwardScrollRef.current) return; // ignore hovers during forward scroll lock
                            e.stopPropagation();
                            const target = e.currentTarget as HTMLElement;
                            const grid = target.parentElement as HTMLElement;

                            // Record original scroll position if starting a new hover session
                            if (!expandedItemRef.current) {
                              originalScrollYRef.current = window.scrollY;
                            }

                            // Collapse any previously expanded item
                            if (expandedItemRef.current && expandedItemRef.current !== target) {
                              const prev = expandedItemRef.current;
                              prev.style.gridColumn = '';
                              prev.classList.remove('masonry-item-expanded');
                              const prevImg = prev.querySelector('img');
                              if (prevImg) prevImg.classList.remove('expanded-image');
                            }
                            if (expandedGridRef.current && expandedGridRef.current !== grid) {
                              expandedGridRef.current.style.setProperty('--grid-scale', '1');
                            }

                            // Expand across columns
                            target.style.gridColumn = '1 / -1';
                            target.classList.add('masonry-item-expanded');
                            const imgEl = (target.querySelector('img') as HTMLElement) || target;
                            if (imgEl) imgEl.classList.add('expanded-image');

                            // Save refs
                            expandedItemRef.current = target;
                            expandedGridRef.current = grid;

                            // After layout, recompute row span and scroll
                            requestAnimationFrame(() => {
                              const styles = window.getComputedStyle(grid);
                              const rowHeight = parseFloat(styles.getPropertyValue('grid-auto-rows')) || 8;
                              const rowGap = parseFloat(styles.getPropertyValue('row-gap')) || 16;
                              const unscaledHeight = (imgEl as HTMLElement).getBoundingClientRect().height;
                              const span = Math.max(1, Math.ceil((unscaledHeight + rowGap) / (rowHeight + rowGap)));
                              target.style.gridRowEnd = `span ${span}`;

                              // Scroll after scale applied
                              requestAnimationFrame(() => {
                                const rect = target.getBoundingClientRect();
                                const viewportHeight = window.innerHeight;
                                const desiredTop = Math.min(rect.top + window.scrollY - 120, document.documentElement.scrollHeight - viewportHeight);
                                const outOfViewTop = rect.top < 80;
                                const outOfViewBottom = rect.bottom > viewportHeight - 80;
                                if (outOfViewTop || outOfViewBottom) {
                                  // Engage forward scroll lock to prevent other hovers from taking over
                                  isForwardScrollRef.current = true;
                                  const y = Math.max(0, desiredTop);
                                  window.scrollTo({ top: y, behavior: 'smooth' });

                                  // Monitor until close to target (or timeout), then release lock
                                  const start = Date.now();
                                  const checkDone = () => {
                                    const closeEnough = Math.abs(window.scrollY - y) < 2;
                                    const timedOut = Date.now() - start > 1600; // fallback
                                    if (closeEnough || timedOut) {
                                      isForwardScrollRef.current = false;
                                    } else {
                                      requestAnimationFrame(checkDone);
                                    }
                                  };
                                  requestAnimationFrame(checkDone);
                                }
                              });
                            });
                          }}
                          onMouseLeave={(e) => {
                            e.stopPropagation();
                            const target = e.currentTarget as HTMLElement;
                            const grid = target.parentElement as HTMLElement;

                            // If we are in forward scroll lock for this item, don't collapse immediately.
                            if (isForwardScrollRef.current && expandedItemRef.current === target) {
                              const waitForUnlock = () => {
                                if (!isForwardScrollRef.current) {
                                  // After unlock, check if pointer returned; if not, collapse
                                  if (!target.matches(':hover')) {
                                    // proceed to collapse below
                                    const collapseEvent = new Event('collapse');
                                    target.dispatchEvent(collapseEvent);
                                  }
                                } else {
                                  requestAnimationFrame(waitForUnlock);
                                }
                              };
                              requestAnimationFrame(waitForUnlock);
                              return;
                            }

                            // Reset column span and classes
                            target.style.gridColumn = '';
                            target.classList.remove('masonry-item-expanded');
                            const imgEl = target.querySelector('img');
                            if (imgEl) imgEl.classList.remove('expanded-image');

                            // Recompute span in normal state after layout
                            requestAnimationFrame(() => {
                              const styles = window.getComputedStyle(grid);
                              const rowHeight = parseFloat(styles.getPropertyValue('grid-auto-rows')) || 8;
                              const rowGap = parseFloat(styles.getPropertyValue('row-gap')) || 16;
                              const content = (target.querySelector('img') as HTMLElement) || target;
                              const height = content.getBoundingClientRect().height;
                              const span = Math.max(1, Math.ceil((height + rowGap) / (rowHeight + rowGap)));
                              target.style.gridRowEnd = `span ${span}`;
                            });

                            // Decide whether to scroll back
                            const nextTarget = (e.relatedTarget as Node) || null;
                            const movingWithinGrid = !!(nextTarget && grid.contains(nextTarget) && (nextTarget as Element).closest('.masonry-item'));

                            if (expandedItemRef.current === target) {
                              // Clear refs for current session
                              expandedItemRef.current = null;
                              expandedGridRef.current = null;

                              // Scroll back to original position if not moving to another item inside the same grid
                              if (!movingWithinGrid && originalScrollYRef.current !== null) {
                                const y = Math.max(0, originalScrollYRef.current);
                                window.scrollTo({ top: y, behavior: 'smooth' });
                                originalScrollYRef.current = null;
                              }
                            }
                          }}
                        >
                          <img
                            src={image.src}
                            alt={image.alt || post.title}
                            className="w-full h-auto object-cover rounded-sm shadow-sm transition-all duration-500 ease-out cursor-pointer"
                            loading="lazy"
                            onClick={() => openLightbox(index, imgIndex)}
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

      {/* Image Lightbox Modal */}
      {lightbox.isOpen && posts[lightbox.postIndex]?.images && (
        <div 
          className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center"
          onClick={closeLightbox}
        >
          {/* Close Button */}
          <button
            onClick={closeLightbox}
            className="absolute top-4 right-4 text-white hover:text-neutral-300 transition-colors z-10"
            aria-label="Close lightbox"
          >
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Previous Button */}
          {posts[lightbox.postIndex].images!.length > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                navigateLightbox('prev');
              }}
              className="absolute left-4 text-white hover:text-neutral-300 transition-colors z-10 bg-black/50 hover:bg-black/70 rounded-full p-3"
              aria-label="Previous image"
            >
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}

          {/* Next Button */}
          {posts[lightbox.postIndex].images!.length > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                navigateLightbox('next');
              }}
              className="absolute right-4 text-white hover:text-neutral-300 transition-colors z-10 bg-black/50 hover:bg-black/70 rounded-full p-3"
              aria-label="Next image"
            >
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}

          {/* Image Container */}
          <div 
            className="relative max-w-7xl max-h-[90vh] mx-auto px-16"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={posts[lightbox.postIndex].images![lightbox.currentImageIndex].src}
              alt={posts[lightbox.postIndex].images![lightbox.currentImageIndex].alt || posts[lightbox.postIndex].title}
              className="max-w-full max-h-[90vh] object-contain rounded-sm"
            />
            
            {/* Image Counter */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/70 text-white text-sm px-4 py-2 rounded-full">
              {lightbox.currentImageIndex + 1} / {posts[lightbox.postIndex].images!.length}
            </div>

            {/* Caption */}
            {posts[lightbox.postIndex].images![lightbox.currentImageIndex].alt && (
              <div className="absolute bottom-16 left-1/2 -translate-x-1/2 bg-black/70 text-white text-sm px-4 py-2 rounded max-w-md text-center">
                {posts[lightbox.postIndex].images![lightbox.currentImageIndex].alt}
              </div>
            )}
          </div>

          {/* Keyboard Hints */}
          <div className="absolute bottom-4 left-4 text-white/50 text-xs space-y-1">
            <div>← → Navigate</div>
            <div>ESC Close</div>
          </div>
        </div>
      )}
    </div>
  );
}
