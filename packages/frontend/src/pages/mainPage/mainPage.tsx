import { useContext, useState, useEffect } from 'react'
import { useHistory, useLocation } from 'react-router-dom'
import { observer } from 'mobx-react-lite'

import PostContext from '../../context/Post'
import UserContext from '../../context/User'
import UnirepContext from '../../context/Unirep'

import { QueryType, AlertType } from '../../constants'
import BasicPage from '../basicPage/basicPage'
import PostsList from '../../components/postsList'
import Feed from '../../components/feed'

type Props = {
    topic: string
}

const MainPage = ({ topic }: Props) => {
    const history = useHistory()
    const postContext = useContext(PostContext)
    const userContext = useContext(UserContext)
    const unirepConfig = useContext(UnirepContext)
    const location = useLocation()

    const [query, setQuery] = useState<QueryType>(QueryType.New)

    useEffect(() => {
        loadMorePosts(topic)
    }, [topic, query, location])

    const loadMorePosts = (topic: string) => {
        const key = `${query}-${topic}`
        postContext.loadFeed(query, topic, postContext.feeds[key] || [])
    }

    const gotoNewPost = () => {
        if (
            userContext.userState &&
            userContext.spendableReputation >= unirepConfig.postReputation
        ) {
            history.push(
                {
                    pathname: `/new`,
                    state: { topic: formatTopic(topic) },
                },
                { isConfirmed: true }
            )
        }
    }

    // topic string formatter
    const formatTopic = (topic: string) => {
        return topic ? topic.charAt(0).toUpperCase() + topic.slice(1) : 'All'
    }

    const getPostIds = () => {
        const key = `${query}-${topic}`
        return postContext.feeds[key] || []
    }

    return (
        <>
            <BasicPage topic={formatTopic(topic)}>
                <div className="create-post" onClick={gotoNewPost}>
                    {!userContext.userState
                        ? AlertType.postNotLogin
                        : userContext.spendableReputation <
                          unirepConfig.postReputation
                        ? AlertType.postNotEnoughPoints
                        : 'Create post'}
                </div>
                <Feed feedChoice={query} setFeedChoice={setQuery} />
                <PostsList
                    postIds={getPostIds()}
                    loadMorePosts={loadMorePosts}
                />
            </BasicPage>
        </>
    )
}
export default observer(MainPage)
