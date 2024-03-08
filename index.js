const axios = require('axios')
const cheerio = require('cheerio')
const fs = require('fs')

const REPOS = ['wenzhixin/bootstrap-table', 'wenzhixin/bootstrap-table-examples']

class Stats {
  constructor (user, since, until, repos = REPOS) {
    this.user = user
    this.since = since
    this.until = until
    this.repos = repos

    this.init()
  }

  getUrl (baseUrl, query) {
    return `https://github.com/${baseUrl}?q=${query.split(' ')
      .map(it => encodeURIComponent(it)).join('+')}`
  }

  loadUrl (baseUrl, query, selector) {
    return axios.get(this.getUrl(baseUrl, query)).then(res => {
      const $ = cheerio.load(res.data)

      return parseInt($(selector).text().trim())
    })
  }

  loadApi (url, params, property) {
    return axios.get(`https://api.github.com/repos/${url}`, {
      params
    }).then(res => {
      return property ? res.data[property] : res.data
    })
  }

  async init() {
    const file = `./stats/${this.user}_${this.since}_${this.until}.md`
    const titles = [
      'Repo',
      'Releases',
      'Commits',
      'Submitted Pull Requests',
      'Handled Pull Requests',
      'Closed Issues'
    ]
    const content = [
      `* **User**: ${this.user}`,
      `* **Time**: ${this.since} ~ ${this.until}`,
      '',
      this.getTableRow(titles),
      this.getTableRow(new Array(titles.length).fill('---'))
    ]
    const stats = []

    for (const repo of this.repos) {
      stats.push([
        repo,
        await this.countReleases(repo),
        await this.countCommits(repo),
        await this.countSubmitPRs(repo),
        await this.countHandlePRs(repo),
        await this.countClosedIssues(repo)
      ])
    }

    for (const stat of stats) {
      content.push(this.getTableRow(stat))
    }

    const totals = stats.reduce((acc, curr) => {
      curr.forEach((val, index) => {
        if (index !== 0) {
          acc[index] = (acc[index] || 0) + val
        }
      })
      return acc
    }, [])

    totals[0] = 'Total'

    content.push(this.getTableRow(totals))

    fs.writeFileSync(file, content.join('\n'))
  }

  getTableRow (array) {
    return ['', ...array, ''].join('|')
  }

  async countReleases (repo) {
    const res = await this.loadApi(`${repo}/releases`, {
      per_page: 100,
      page: 1
    })

    return res.filter(it => it.author.login === this.user &&
      it.published_at >= `${this.since}T00-00-00Z` &&
      it.published_at < `${this.until}T00-00-00Z`).length || 0
  }

  async countCommits (repo) {
    return await this.loadApi(`${repo}/commits`, {
      author: this.user,
      since: `${this.since}T00-00-00Z`,
      until: `${this.until}T00-00-00Z`,
      per_page: 100,
      page: 1
    }, 'length')
  }

  async countSubmitPRs (repo) {
    return await this.loadUrl(
      `${repo}/pulls`,
      `is:pr is:merged author:${this.user} merged:${this.since}..${this.until}`,
      '#js-issues-toolbar .states a.selected'
    )
  }

  async countHandlePRs (repo) {
    return await this.loadUrl(
      `${repo}/pulls`,
      `is:pr is:merged -author:${this.user} involves:${this.user} merged:${this.since}..${this.until}`,
      '#js-issues-toolbar .states a.selected'
    )
  }

  async countClosedIssues (repo) {
    return await this.loadUrl(
      `${repo}/issues`,
      `is:issue is:closed involves:${this.user} closed:${this.since}..${this.until}`,
      '#js-issues-toolbar .states a.selected'
    )
  }
}

new Stats(
  process.argv[2],
  process.argv[3],
  process.argv[4]
)
