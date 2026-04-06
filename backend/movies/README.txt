Add sample `.mp4` files here to enable protected streaming.

Expected filenames:
- stellar-echo.mp4
- red-circuit.mp4
- monsoon-city.mp4
- glass-route.mp4
- paper-hearts.mp4
- afterparty-protocol.mp4
- black-dune-files.mp4
- velocity-house.mp4

The backend validates rental access first, then serves `/stream/:movieId`.
If a file is missing, the API returns a helpful 404 message instead of crashing.
