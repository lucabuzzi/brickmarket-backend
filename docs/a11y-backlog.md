# Accessibility backlog (jsx-a11y warnings)

Generated with `npm run lint:a11y -- --markdown` in `client/` on 2026-09-30. Each row is an element that reacts to a click or hover but cannot be reached or operated from the keyboard. Fixing one changes behaviour (turn it into a `<button>`, or add role, tabIndex and key handlers), so each needs a manual check in the UI.

| File | Line | Rule | Level |
|---|---|---|---|
| src/components/BrickRating.jsx | 8 | click-events-have-key-events | warn |
| src/components/BrickRating.jsx | 8 | no-static-element-interactions | warn |
| src/components/FeatureListingModal.jsx | 89 | click-events-have-key-events | warn |
| src/components/FeatureListingModal.jsx | 89 | no-static-element-interactions | warn |
| src/components/FeatureListingModal.jsx | 97 | click-events-have-key-events | warn |
| src/components/FeatureListingModal.jsx | 97 | no-static-element-interactions | warn |
| src/components/Layout.jsx | 139 | click-events-have-key-events | warn |
| src/components/Layout.jsx | 139 | no-static-element-interactions | warn |
| src/components/Layout.jsx | 311 | click-events-have-key-events | warn |
| src/components/Layout.jsx | 311 | no-static-element-interactions | warn |
| src/components/ReviewModal.jsx | 58 | click-events-have-key-events | warn |
| src/components/ReviewModal.jsx | 58 | no-static-element-interactions | warn |
| src/components/ReviewModal.jsx | 70 | click-events-have-key-events | warn |
| src/components/ReviewModal.jsx | 70 | no-static-element-interactions | warn |
| src/pages/AdminAnalyticsCalendar.jsx | 181 | click-events-have-key-events | warn |
| src/pages/AdminAnalyticsCalendar.jsx | 181 | no-static-element-interactions | warn |
| src/pages/AdminAnalyticsCalendar.jsx | 185 | click-events-have-key-events | warn |
| src/pages/AdminAnalyticsCalendar.jsx | 185 | no-static-element-interactions | warn |
| src/pages/AdminDashboard.jsx | 605 | click-events-have-key-events | warn |
| src/pages/AdminDashboard.jsx | 605 | no-static-element-interactions | warn |
| src/pages/AdminDashboard.jsx | 606 | click-events-have-key-events | warn |
| src/pages/AdminDashboard.jsx | 606 | no-static-element-interactions | warn |
| src/pages/CreateAuction.jsx | 459 | click-events-have-key-events | warn |
| src/pages/CreateAuction.jsx | 459 | no-static-element-interactions | warn |
| src/pages/CreateAuction.jsx | 482 | click-events-have-key-events | warn |
| src/pages/CreateAuction.jsx | 482 | no-static-element-interactions | warn |
| src/pages/CreateAuction.jsx | 546 | mouse-events-have-key-events | warn |
| src/pages/CreateAuction.jsx | 546 | mouse-events-have-key-events | warn |
| src/pages/ListingDetail.jsx | 92 | click-events-have-key-events | warn |
| src/pages/ListingDetail.jsx | 92 | no-noninteractive-element-interactions | warn |
| src/pages/SearchResults.jsx | 161 | mouse-events-have-key-events | warn |
| src/pages/SearchResults.jsx | 162 | mouse-events-have-key-events | warn |
| src/pages/Sell.jsx | 788 | mouse-events-have-key-events | warn |
| src/pages/Sell.jsx | 788 | mouse-events-have-key-events | warn |
| src/pages/UserSearch.jsx | 116 | click-events-have-key-events | warn |
| src/pages/UserSearch.jsx | 116 | no-static-element-interactions | warn |
| src/pages/UserSearch.jsx | 119 | mouse-events-have-key-events | warn |
| src/pages/UserSearch.jsx | 120 | mouse-events-have-key-events | warn |

Total: 38
