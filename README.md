#  [![NPM version][npm-image]][npm-url] [![Build Status][travis-image]][travis-url] [![Dependency Status][daviddm-url]][daviddm-image]

> The best module ever.


## Install

```sh
$ npm install --save slavedriver
```


## Usage

```json

{
  "name": "my application",
  "containers": {
    "postgres": {
      "image": "postgres:9.4",
      "command": ["/bin/bash", "-c", "..."],
      "env": {
        "RAILS_ENV": "production"
      }
      links: [],
      external_links: [],
      ports: [],
      expose: [],
      volumes: [],
      volumes_from: [],
      cap_add: [],
      cap_drop: [],
      dns_search: [],
      working_dir:
      entrypoint:
      user:
      hostname:
      domainname:
      mem_limit,
      privileged,
      restart,
      stdin_open,
      tty,
      cpu_shares

    }
  }

}

```

## License

MIT © [Dragan Milic]()


[npm-url]: https://npmjs.org/package/slavedriver
[npm-image]: https://badge.fury.io/js/slavedriver.svg
[travis-url]: https://travis-ci.org/draganm/slavedriver
[travis-image]: https://travis-ci.org/draganm/slavedriver.svg?branch=master
[daviddm-url]: https://david-dm.org/draganm/slavedriver.svg?theme=shields.io
[daviddm-image]: https://david-dm.org/draganm/slavedriver
