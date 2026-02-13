import net from 'net';

// Une implémentation basique du protocole HTTP utilisant des sockets TCP brutes (net module)
// Cela montre comment le protocole fonctionne "sous le capot" avec des chaînes de caractères.

const server = net.createServer((socket) => {
    console.log('Client connected');

    socket.on('data', (data) => {
        const request = data.toString();
        console.log('Received request:\n', request);

        // Analyse basique de la requête
        const [statusLine] = request.split('\r\n');
        const [method, path] = statusLine.split(' ');

        // Construction de la réponse HTTP manuellement
        let body = '';
        let status = '200 OK';

        if (path === '/Protocol') {
            body = JSON.stringify({ message: 'Hello from raw HTTP server!', protocol: 'HTTP/1.1' });
        } else {
            status = '404 Not Found';
            body = JSON.stringify({ error: 'Route not found' });
        }

        const response = [
            `HTTP/1.1 ${status}`,
            'Content-Type: application/json',
            `Content-Length: ${Buffer.byteLength(body)}`,
            'Connection: close', // On ferme la connexion après la réponse (pas de keep-alive ici pour simplifier)
            '',
            body
        ].join('\r\n');

        socket.write(response);
        socket.end();
    });

    socket.on('end', () => {
        console.log('Client disconnected');
    });
});

const PORT = 8080;
server.listen(PORT, () => {
    console.log(`Raw HTTP Server running on port ${PORT}`);
    console.log(`Test with: curl http://localhost:${PORT}/Protocol`);
});
