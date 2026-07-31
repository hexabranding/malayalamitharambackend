// In-memory data store (replace with MongoDB in production)
const bcrypt = require("bcryptjs");

// Admin credentials — change password before deploying!
const ADMIN_PASSWORD_HASH = bcrypt.hashSync("Admin@123", 10);

const users = [
  {
    id: "1",
    username: "admin",
    email: "admin@malayalamithram.in",
    passwordHash: ADMIN_PASSWORD_HASH,
    role: "admin",
    name: "Malayalamithram Admin",
  },
];

// Sample news articles (mirrors frontend data structure)
const news = [
  {
    id: "rain-alert-kerala-coast",
    title: "കേരള തീരത്ത് ശക്തമായ മഴ: മത്സ്യബന്ധന നിരോധനം",
    titleEn: "Heavy Rain Alert on Kerala Coast: Fishing Ban Imposed",
    category: "kerala",
    subcategory: "weather",
    author: "Staff Reporter",
    date: "2026-06-27",
    image: "/images/blog/1.jpg",
    excerpt: "കേരള തീരത്ത് ശക്തമായ മഴ പ്രതീക്ഷിക്കുന്നതിനാൽ മത്സ്യബന്ധന നൗകകൾ കടലിൽ ഇറക്കരുതെന്ന് നിർദ്ദേശം",
    content: "കേരള തീരത്ത് ഇന്ന് ശക്തമായ മഴ പ്രതീക്ഷിക്കുന്നതായി കാലാവസ്ഥ വകുപ്പ് അറിയിച്ചു...",
    tags: ["മഴ", "കേരളം", "മത്സ്യബന്ധനം"],
    featured: true,
    published: true,
    views: 1240,
    comments: 18,
    createdAt: "2026-06-27T06:00:00Z",
  },
  {
    id: "delhi-policy-meeting",
    title: "ദേശീയ നയ യോഗം ഡൽഹിയിൽ: കേരള മന്ത്രി പങ്കെടുത്തു",
    titleEn: "National Policy Meeting in Delhi: Kerala Minister Attends",
    category: "india",
    subcategory: "politics",
    author: "New Delhi Correspondent",
    date: "2026-06-26",
    image: "/images/blog/2.jpg",
    excerpt: "ഡൽഹിയിൽ നടന്ന ദേശീയ നയ യോഗത്തിൽ കേരള മന്ത്രി പങ്കെടുത്ത് സംസ്ഥാനത്തിന്റെ ആവശ്യങ്ങൾ അവതരിപ്പിച്ചു",
    content: "ഡൽഹിയിൽ ഇന്ന് നടന്ന ദേശീയ നയ യോഗത്തിൽ...",
    tags: ["ഡൽഹി", "കേരളം", "രാഷ്ട്രീയം"],
    featured: false,
    published: true,
    views: 890,
    comments: 12,
    createdAt: "2026-06-26T09:00:00Z",
  },
];

const categories = [
  { id: "kerala", label: "കേരളം", slug: "kerala", count: 0 },
  { id: "india", label: "ഇന്ത്യ", slug: "india", count: 0 },
  { id: "world", label: "ലോകം", slug: "world", count: 0 },
  { id: "business", label: "ബിസിനസ്", slug: "business", count: 0 },
  { id: "sports", label: "കായികം", slug: "sports", count: 0 },
  { id: "entertainment", label: "വിനോദം", slug: "entertainment", count: 0 },
  { id: "technology", label: "ടെക്നോളജി", slug: "technology", count: 0 },
  { id: "health", label: "ആരോഗ്യം", slug: "health", count: 0 },
];

module.exports = { users, news, categories };
