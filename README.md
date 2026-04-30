# IRC Frontend

A React + Vite frontend for the IRC backend, styled with shadcn/ui and Tailwind.

## Stack

- React 19 + Vite
- React Router
- Tailwind CSS v4 + shadcn/ui (radix-ui primitives)
- Axios
- Server-Sent Events for live notifications

## Environment

Create a local `.env` file:

```bash
VITE_API_URL=http://localhost:8080
```

Falls back to `http://localhost:8080`.

## Run

```bash
pnpm install
pnpm dev
pnpm build
pnpm lint
```

## Project structure

```
src/
├── App.jsx                     # root component
├── main.jsx                    # React bootstrap
├── index.css                   # Tailwind + theme tokens
├── api/client.js               # axios instance with JWT refresh
├── config/env.js               # env constants
├── lib/                        # generic helpers
│   ├── api-error.js            # error + field-error parsing
│   ├── format.js               # dates, numbers, media urls, initials
│   └── utils.js                # cn()
├── components/
│   ├── ui/                     # shadcn primitives (avatar, button, card,
│   │                           #   dialog, dropdown-menu, input, label,
│   │                           #   scroll-area, separator, sheet, skeleton,
│   │                           #   tabs, textarea, toaster, tooltip)
│   └── app/                    # app-level composed components
│       ├── app-sidebar.jsx     # slide-out sidebar navigation
│       ├── app-topbar.jsx      # topbar (search, notifications, account)
│       ├── empty-state.jsx
│       ├── page-header.jsx
│       ├── post-card.jsx
│       ├── post-composer.jsx
│       └── user-avatar.jsx
├── features/                   # one folder per domain
│   ├── auth/                   # login + signup + session
│   ├── users/                  # profile, search, profile image
│   ├── social/                 # follow/unfollow/block/restrict
│   ├── notifications/          # list + unread + SSE context
│   ├── posts/                  # feed, CRUD, reactions, comments
│   ├── research/               # feed, search, tags, reactions
│   └── qna/                    # questions + answers
├── layouts/
│   ├── app-layout.jsx          # sidebar + topbar shell (main app)
│   └── auth-layout.jsx         # centered card for login/signup
├── pages/
│   ├── home-page.jsx           # post feed + composer
│   ├── explore-page.jsx        # search posts & research
│   ├── people-page.jsx         # user search + block list
│   ├── profile-page.jsx        # user profile with follow/block/restrict
│   ├── notifications-page.jsx  # live inbox (SSE)
│   ├── research-page.jsx       # published research feed
│   ├── questions-page.jsx      # Q&A list + ask dialog
│   ├── saved-page.jsx
│   ├── settings-page.jsx       # edit profile + avatar upload
│   └── not-found-page.jsx
└── routes/
    ├── app-router.jsx
    └── route-guards.jsx
```

Where to look when editing:

- Add a new API endpoint → put it in the relevant `features/<domain>/<domain>.api.js`.
- Add a new page → create it under `pages/`, then register the route in `routes/app-router.jsx`.
- Add a new shadcn primitive → `components/ui/<name>.jsx`.
- Add a shared building block → `components/app/<name>.jsx`.
- Change navigation items → `components/app/app-sidebar.jsx`.
- Tweak theme tokens / colors → `src/index.css`.

## Backend endpoints used

Auth, users, social actions, notifications (including SSE stream at
`/api/v1/notifications/stream`), posts + comments, research (+ comments, saves,
reactions, search, trending tags), and Q&A. See the feature API modules for the
full contract.
