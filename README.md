# ⚡️ Swift Connect

**Swift Connect** is a modern, secure, and real-time messaging application designed for seamless communication. Built with speed and privacy in mind, it bridges the gap between simple chat apps and professional communication tools.

![Swift Connect Preview](public/favicon.svg)
*(You can add a screenshot of your app dashboard here later)*

## 🚀 Key Features

*   **Real-Time Messaging**: Instant message delivery with live status updates (Sent, Delivered, Read).
*   **Typing Indicators**: See when others are typing in real-time for a more engaging experience.
*   **Smart "Delete for Me"**: Clear your chat history without affecting the other participant's view—your privacy, your control.
*   **Group Chats**: Create dynamic group conversations with multiple participants.
*   **Secure Authentication**: Full email/password login system including "Forgot Password" functionality.
*   **Online Status**: Real-time "Online" and "Last Seen" indicators.
*   **Modern UI/UX**: A sleek, responsive interface built with Tailwind CSS and Shadcn UI, featuring a custom teal/primary theme.

## 🛠️ Tech Stack

*   **Frontend**: React (Vite), TypeScript
*   **Styling**: Tailwind CSS, Shadcn UI, Lucide Icons
*   **Backend & Realtime**: Supabase (PostgreSQL, Realtime Subscriptions, Auth)
*   **State Management**: React Query, React Hooks

## 🚦 Getting Started

### Prerequisites
*   Node.js (v18 or higher)
*   npm or yarn
*   A Supabase project

### Installation

1.  **Clone the repository**
    ```bash
    git clone https://github.com/aarthik5/swift-connect.git
    cd swift-connect
    ```

2.  **Install dependencies**
    ```bash
    npm install
    ```

3.  **Configure Environment**
    Create a `.env` file in the root directory and add your Supabase credentials:
    ```env
    VITE_SUPABASE_URL=your_supabase_project_url
    VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
    ```

4.  **Run the application**
    ```bash
    npm run dev
    ```

## 🗄️ Database Setup

To enable all features (like "Delete for Me"), run the SQL scripts provided in the repository (e.g., `setup_new_database.sql`) in your Supabase SQL Editor. This sets up the necessary tables, RLS policies, and database functions.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---

*Built with ❤️ by Aarthik*
