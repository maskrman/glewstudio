# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

People learning studio and commercial photography.

## Product Purpose

Glewstudio provides a browser-based learning library for photography courses and masterclasses. The homepage should prioritize discovering content, with membership options and instructor information available further down the page.

## Positioning

Open decision: the product's distinct positioning has not been confirmed. Existing copy describes instructors as active in the industry, but that claim is not treated as verified differentiation.

## Operating Context

Visitors arrive at the public homepage to discover courses and membership options. The application also provides a course catalog, dashboard, watchlist, course progress, and video-player routes.

## Capabilities and Constraints

- The application has photography courses, categories, membership tiers, purchases, saved courses, and course-progress features.
- Homepage course rows and featured content should use course information already present in the application; do not invent titles, ratings, or course claims.
- Preserve the configured membership options and prices when presenting plans. Do not introduce new prices.
- The homepage's audience and content-discovery goal take priority; membership information remains available lower on the page.
- Student-count claims and testimonials are not confirmed as verified and should not be used as proof.
- The requested homepage “Mi Lista” control needs an interactive saved/unsaved state; no backend persistence was requested for that control.

## Brand Commitments

- Product name: Glewstudio; retain the existing logo.
- Use the OLED background color `#0A0A0F`.
- Use the user's Netflix/Max reference for streaming discovery patterns, not copied branding or assets.

## Evidence on Hand

- Course and category examples are present in `src/app/dashboard/components/DashboardCarousels.tsx` and `src/app/courses/components/CoursesScreen.tsx`; parts of these lists are explicitly demo or provisional data.
- Configured membership prices and features are in `src/lib/config.ts`.
- Existing homepage metrics and testimonials are present in the landing components but have not been verified by the user.

## Product Principles

- Make it quick for learners to find a relevant photography course.
- Preserve accurate course and membership information.
- Keep the learning catalog central while retaining clear access to membership choices.
