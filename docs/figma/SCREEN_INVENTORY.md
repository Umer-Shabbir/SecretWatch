# SecretWatch Screen Inventory

This is the target screen inventory. Build it module-by-module; do not design all screens in one uncontrolled agent run.

## Marketing

1. Marketing / Landing / Default
2. Marketing / Pricing / Default
3. Marketing / How It Works / Default

## Authentication

4. Auth / GitHub Login / Default
5. Auth / Callback / Loading
6. Auth / Error / Default
7. Auth / Admin Login / Default

## User

8. Dashboard / Overview / Default
9. Dashboard / Overview / Loading
10. Dashboard / Overview / Empty
11. Dashboard / Overview / Error
12. Dashboard / Findings / Default
13. Dashboard / Findings / Empty
14. Dashboard / Findings / Loading
15. Dashboard / Findings / Error
16. Dashboard / Finding Detail / Pending
17. Dashboard / Finding Detail / Approved
18. Dashboard / Finding Detail / Flagged
19. Dashboard / Finding Detail / Ignored
20. Dashboard / Finding Detail / Failed
21. Dashboard / Flags / Default
22. Dashboard / Flags / Empty
23. Dashboard / Tokens / Default
24. Dashboard / Tokens / Empty
25. Dashboard / Tokens / Add
26. Dashboard / Tokens / Delete Confirmation
27. Dashboard / Scan Rules / Default
28. Dashboard / Scan Rules / Empty

## Admin

29. Admin / Overview / Default
30. Admin / Review Queue / Default
31. Admin / Review Queue / Empty
32. Admin / Review Queue / Loading
33. Admin / Review Queue / Approve Confirmation
34. Admin / Review Queue / Ignore Confirmation
35. Admin / Users / Default
36. Admin / Users / Empty
37. Admin / Rules / Default
38. Admin / Rules / Create
39. Admin / Rules / Edit
40. Admin / Templates / Default
41. Admin / Templates / Create
42. Admin / Templates / Edit
43. Admin / Workers / Default
44. Admin / Workers / Scanner Detail
45. Admin / Workers / Flagger Detail
46. Admin / Workers / Scheduler Detail

## Responsive

Each applicable screen should have documented:

- desktop
- tablet
- mobile

Do not create a separate frame for every viewport if responsive behavior can be expressed cleanly, but do create explicit mobile frames where the layout materially changes.
