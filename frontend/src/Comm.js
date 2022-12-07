const URL = window.API_URL && window.API_URL !== '${API_URL}' ? `https://${window.API_URL}/` : 'https://3jjxddo33l.execute-api.eu-west-1.amazonaws.com/default/checkAdapter';
class Comm {
    static check(repo, branch, cb) {
        const url = `${URL}?url=${encodeURIComponent(repo)}${branch ? `&branch=${encodeURIComponent(branch)}` : ''}`;
        try {
            fetch(url)
                .then(res => res.json())
                .then(
                    result => cb && cb(result.error || null, result),
                    error => cb && cb(error)
                );
        } catch (error) {
            cb && cb(error);
        }
    }
}

export default Comm;