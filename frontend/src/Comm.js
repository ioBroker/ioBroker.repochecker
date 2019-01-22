const URL = 'https://3jjxddo33l.execute-api.eu-west-1.amazonaws.com/default/checkAdapter';
class Comm {
    static check(repo, cb) {
        const url = `${URL}?url=${encodeURIComponent(repo)}`;
        try {
            fetch(url)
                .then(res => res.json())
                .then(
                    result => cb && cb(null, result),
                    error => cb && cb(error)
                );
        } catch (error) {
            cb && cb(error);
        }
    }
}

export default Comm;