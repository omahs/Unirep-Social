import { useContext } from 'react'
import { useHistory } from 'react-router-dom'
import { observer } from 'mobx-react-lite'

import UserContext from '../../context/User'
import PostContext from '../../context/Post'

import WritingField from '../../components/writingField'
import BasicPage from '../basicPage/basicPage'
import { DataType } from '../../constants'

const NewPage = () => {
    const history = useHistory()
    const userContext = useContext(UserContext)
    const postContext = useContext(PostContext)

    const preventPropagation = (event: any) => {
        event.stopPropagation()
    }

    const submit = async (
        title: string,
        content: string,
        topic: string,
        epkNonce: number,
        reputation: number
    ) => {
        if (!userContext.userState) {
            throw new Error('Should not be able to create post without login')
        }
        postContext.publishPost(title, content, topic, epkNonce, reputation)
        history.push('/')
    }

    // todo: new page can be resued to publish a post so the `submit` function gets the correct pathname for the topic

    return (
        <BasicPage title={'Create Post'}>
            <WritingField
                type={DataType.Post}
                submit={submit}
                submitBtnName="Post - 5 points"
                onClick={preventPropagation}
                showDetail={true}
            />
        </BasicPage>
    )
}

export default observer(NewPage)
