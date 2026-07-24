# MI Jajan

A lightweight menu and group-ordering app for a private local network.

## Run on the local network

Install dependencies:

```bash
npm install
```

For development:

```bash
npm run dev
```

For a production-style local server:

```bash
npm run build
npm start
```

The server listens on all network interfaces at port `3000`. Other devices on
the same internal network can open:

```text
http://YOUR-SERVER-LAN-IP:3000
```

Allow inbound TCP port `3000` in the server firewall if needed. Do not forward
this port through the internet-facing router.

## Local data

Menus, orders, payment proofs, and menu-item images are stored under `data/`.
That directory is intentionally ignored by Git. Back it up if the order history
must be retained.

Set `TINYTABLE_DATA_DIR` before starting the server to store data elsewhere.
