# Spotifriends

Spotifriends is a music-based social networking application that helps users connect with others who share similar music tastes. Users create a profile, upload photos, and build a curated Top 5 playlist. A compatibility algorithm analyzes playlists to generate recommendations based on shared songs, artists, and genres.

## Features

* User authentication and account management
* Profile creation and photo uploads
* Top 5 playlist selection
* Compatibility-based profile recommendations
* Shared genre visualization
* Dynamic similarity scoring
* Cloud-based profile and playlist storage
* Cross-platform mobile support

## Technologies

### Frontend

* React Native
* Expo
* Expo Router
* TypeScript

### Backend

* Supabase
* PostgreSQL
* Supabase Authentication
* Supabase Storage

### Additional Libraries

* Expo Image Picker
* Expo FileSystem
* Base64 ArrayBuffer

## How It Works

1. Create an account and log in.
2. Upload profile photos.
3. Select your Top 5 songs.
4. Browse recommended profiles.
5. View compatibility percentages and shared genres.
6. Connect with users who share similar music interests.

## Installation

### Prerequisites

* Node.js
* npm
* Expo Go (for mobile testing)
* Supabase project configured

### Setup

Clone the repository:

```bash
git clone https://github.com/YOUR_USERNAME/spotifriends.git
cd spotifriends
```

Install dependencies:

```bash
npm install
```

Create a `.env` file and configure your Supabase credentials:

```env
EXPO_PUBLIC_SUPABASE_URL=your_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_key
```

Start the development server:

```bash
npx expo start
```

To run using tunnel mode:

```bash
npx expo start --tunnel
```
